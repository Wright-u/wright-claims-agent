import { llmClient, type ILllmClient } from '../llm/client.js';
import type { LlmBlock, LlmMessage, ToolDef } from '../llm/types.js';
import { prompts } from '../llm/prompts.js';
import { coreConnector, type CoreClientConnector } from '../mcp/connect.js';
import { Budget } from './budget.js';
import { VerdictValidator, type RawVerdict } from './validator.js';
import { VerificationOutcomeFactory } from './outcome.js';
import { ClaimNormalizer } from '../normalize/normalize.js';
import { LlmJsonResponseParser } from '../llm/jsonResponse.js';
import { LlmVerdictOutputSchema } from '../domain/schemas.js';
import type {
	Claim,
	NarrativeVerificationResult,
	TraceStep,
	VerifyResult,
} from '../domain/types.js';

export class ClaimVerifier {
	constructor(
		private readonly client: ILllmClient = llmClient,
		private readonly connector: CoreClientConnector = coreConnector,
		private readonly validator = new VerdictValidator(),
		private readonly outcomes = new VerificationOutcomeFactory(),
		private readonly normalizer = new ClaimNormalizer(client),
		private readonly responseParser = new LlmJsonResponseParser()
	) {}

	async verify(
		appName: string,
		narrative: string
	): Promise<NarrativeVerificationResult> {
		const claims = await this.normalizer.normalize(appName, narrative);
		const results: VerifyResult[] = [];
		for (const claim of claims) {
			results.push(await this.verifyClaim(appName, claim));
		}
		return { claims, results };
	}

	private async verifyClaim(
		appName: string,
		claim: Claim
	): Promise<VerifyResult> {
		if (claim.type === 'qualitative') {
			return this.outcomes.undetermined(
				claim.id,
				0,
				0,
				[],
				'Qualitative claims are subjective and cannot be verified from code anatomy.'
			);
		}

		const budget = new Budget();
		const core = await this.connector.connect();

		const coreTools: ToolDef[] = core.tools.map((t) => ({
			name: t.name,
			description: t.description,
			input_schema: t.inputSchema,
		}));
		const llmTools: ToolDef[] = coreTools;
		const scopedToolNames = new Set(
			coreTools
				.filter((tool) => this.isAppScoped(tool))
				.map((t) => t.name)
		);

		const seenEvidence = new Set<string>();
		const trace: TraceStep[] = [];

		const messages: LlmMessage[] = [
			{
				role: 'user',
				content: `Claim to verify: "${claim.text}"`,
			},
		];

		try {
			for (let round = 1; round <= budget.maxRounds; round++) {
				const last = budget.isLastRound(round);
				if (last) {
					messages.push({
						role: 'user',
						content:
							'This is your final round. Return your verdict as the required JSON object now.',
					});
				}

				let response;
				try {
					response = await this.client.complete({
						system: prompts.verifySystem(appName),
						tools: last ? undefined : llmTools,
						// JSON mode makes the provider generate message content rather
						// than an undeclared function call (for example, `json`).
						jsonResponse: last,
						messages,
					});
				} catch (err) {
					//for any provider-side failure
					const message =
						err instanceof Error ? err.message : String(err);
					trace.push({
						round,
						tool: '__llm_error__',
						args: {},
						resultSummary: message.slice(0, 200),
					});
					return this.outcomes.undetermined(
						claim.id,
						round,
						budget.codeRequestsUsed,
						trace,
						`LLM call failed on round ${round}: ${message}`
					);
				}
				messages.push({ role: 'assistant', content: response.content });

				const toolUses = response.content.filter(
					(b): b is Extract<typeof b, { type: 'tool_use' }> =>
						b.type === 'tool_use'
				);

				if (toolUses.length === 0) {
					const verdict = this.parseVerdict(response.content);
					if (verdict) {
						const error = this.validator.check(
							verdict,
							seenEvidence
						);
						if (!error) {
							return this.outcomes.finish(
								claim.id,
								verdict,
								round,
								budget.codeRequestsUsed,
								trace
							);
						}
						messages.push({ role: 'user', content: error });
						continue;
					}
					messages.push({
						role: 'user',
						content:
							'Return a valid JSON verdict, or use an available tool to gather more evidence.',
					});
					continue;
				}

				const results: {
					type: 'tool_result';
					tool_use_id: string;
					content: string;
					is_error?: boolean;
				}[] = [];
				for (const use of toolUses) {
					if (this.readsSymbolCode(use.name, coreTools)) {
						if (!budget.canRequestCode()) {
							results.push({
								type: 'tool_result',
								tool_use_id: use.id,
								is_error: true,
								content:
									'Code request budget used. Decide from the structure, or return an "unknown" JSON verdict.',
							});
							continue;
						}
						budget.spendCodeRequest();
					}

					const args = {
						...(use.input as Record<string, unknown>),
						...(scopedToolNames.has(use.name) ? { appName } : {}),
					};

					const out = await core.callTool(use.name, args);
					const text = JSON.stringify(out.content);
					this.validator.collectEvidence(text, seenEvidence);
					trace.push({
						round,
						tool: use.name,
						args,
						resultSummary: text.slice(0, 200),
					});
					results.push({
						type: 'tool_result',
						tool_use_id: use.id,
						content: text,
					});
				}

				messages.push({ role: 'user', content: results });
			}

			return this.outcomes.undetermined(
				claim.id,
				budget.maxRounds,
				budget.codeRequestsUsed,
				trace
			);
		} finally {
			await core.close();
		}
	}

	private isAppScoped(tool: ToolDef): boolean {
		const props = (
			tool.input_schema as { properties?: Record<string, unknown> }
		)?.properties;
		return Boolean(props && 'appName' in props);
	}

	private readsSymbolCode(name: string, tools: ToolDef[]): boolean {
		const tool = tools.find((candidate) => candidate.name === name);
		const props = (
			tool?.input_schema as { properties?: Record<string, unknown> }
		)?.properties;
		return Boolean(
			props &&
			'symbolPath' in props &&
			tool?.description.toLowerCase().includes('implementation')
		);
	}

	private parseVerdict(blocks: LlmBlock[]): RawVerdict | null {
		try {
			const parsed = LlmVerdictOutputSchema.parse(
				this.responseParser.parse(blocks)
			);
			return parsed;
		} catch {
			return null;
		}
	}
}
