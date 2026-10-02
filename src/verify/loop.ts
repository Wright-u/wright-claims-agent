import { callLlm } from '../llm/client.js';
import type { ToolDef, LlmMessage } from '../llm/types.js';
import { verifySystemPrompt } from '../llm/prompts.js';
import { connectToCore } from '../mcp/connect.js';
import { config } from '../config.js';
import { Budget } from './budget.js';
import { checkVerdict, collectEvidence, type RawVerdict } from './validator.js';
import { finish, undetermined } from './outcome.js';
import type { Claim, TraceStep, VerifyResult } from '../domain/types.js';

const submitTool: ToolDef = {
	name: 'submit_verdict',
	description:
		'Give the final verdict. Call this once you can decide, or when evidence is insufficient.',
	input_schema: {
		type: 'object',
		properties: {
			verdict: {
				enum: ['supported', 'contradicted', 'not_found', 'unknown'],
			},
			reasoning: { type: 'string' },
			evidence: {
				type: 'array',
				items: { type: 'string' },
				description:
					'identifiers (e.g. symbol ids) returned by earlier tool calls',
			},
		},
		required: ['verdict', 'reasoning', 'evidence'],
	},
};

function isContainerScoped(tool: ToolDef): boolean {
	const props = (
		tool.input_schema as { properties?: Record<string, unknown> }
	)?.properties;
	return Boolean(props && 'containerId' in props);
}

export async function verify(
	containerId: string,
	claim: Claim
): Promise<VerifyResult> {
	const budget = new Budget();
	const core = await connectToCore();

	const coreTools: ToolDef[] = core.tools.map((t) => ({
		name: t.name,
		description: t.description,
		input_schema: t.inputSchema,
	}));
	const llmTools: ToolDef[] = [...coreTools, submitTool];
	const scopedToolNames = new Set(
		coreTools.filter(isContainerScoped).map((t) => t.name)
	);

	const seenEvidence = new Set<string>();
	const trace: TraceStep[] = [];

	// Pre-load the outline so round 1 isn't spent rediscovering what's already
	// knowable. This costs one extra tool call up front but saves a full LLM round
	let outlineText = '(outline unavailable)';
	try {
		const outlineTool = core.tools.find(
			(t) => t.name === config.OUTLINE_TOOL_NAME
		);
		if (outlineTool) {
			const out = await core.callTool(config.OUTLINE_TOOL_NAME, {
				containerId,
			});
			const text = JSON.stringify(out.content);
			collectEvidence(text, seenEvidence);
			trace.push({
				round: 0,
				tool: config.OUTLINE_TOOL_NAME,
				args: { containerId },
				resultSummary: text.slice(0, 200),
			});
			outlineText = text;
		}
	} catch {
		// If the outline is unavailable, the model can still search/ask
	}

	const messages: LlmMessage[] = [
		{
			role: 'user',
			content: `Claim to verify: "${claim.text}"\n\nContainer outline:\n${outlineText}`,
		},
	];

	try {
		for (let round = 1; round <= budget.maxRounds; round++) {
			const last = budget.isLastRound(round);
			if (last) {
				messages.push({
					role: 'user',
					content:
						'This is your final round. Submit your verdict now.',
				});
			}

			let response;
			try {
				response = await callLlm({
					system: verifySystemPrompt(containerId),
					tools: last ? [submitTool] : llmTools,
					forceTool: last ? 'submit_verdict' : undefined,
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
				return undetermined(
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
				messages.push({
					role: 'user',
					content: 'Use a tool, or call submit_verdict.',
				});
				continue;
			}

			const results: {
				type: 'tool_result';
				tool_use_id: string;
				content: string;
				is_error?: boolean;
			}[] = [];
			let submitted: VerifyResult | null = null;

			for (const use of toolUses) {
				if (use.name === 'submit_verdict') {
					const v = use.input as unknown as RawVerdict;
					const err = checkVerdict(v, seenEvidence);
					if (err) {
						results.push({
							type: 'tool_result',
							tool_use_id: use.id,
							is_error: true,
							content: err,
						});
						continue;
					}
					submitted = finish(
						claim.id,
						v,
						round,
						budget.codeRequestsUsed,
						trace
					);
					break;
				}

				if (use.name === config.CODE_READ_TOOL_NAME) {
					if (!budget.canRequestCode()) {
						results.push({
							type: 'tool_result',
							tool_use_id: use.id,
							is_error: true,
							content:
								"Code request budget used. Decide from the structure, or submit 'unknown'.",
						});
						continue;
					}
					budget.spendCodeRequest();
				}

				const args = {
					...(use.input as Record<string, unknown>),
					...(scopedToolNames.has(use.name) ? { containerId } : {}),
				};

				const out = await core.callTool(use.name, args);
				const text = JSON.stringify(out.content);
				collectEvidence(text, seenEvidence);
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

			if (submitted) return submitted;
			messages.push({ role: 'user', content: results });
		}

		return undetermined(
			claim.id,
			budget.maxRounds,
			budget.codeRequestsUsed,
			trace
		);
	} finally {
		await core.close();
	}
}
