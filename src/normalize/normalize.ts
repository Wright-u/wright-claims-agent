import { callLlm } from '../llm/client.js';
import type { ToolDef } from '../llm/types.js';
import { normalizeSystemPrompt } from '../llm/prompts.js';
import { LlmClaimsOutputSchema } from '../domain/schemas.js';
import type { Claim } from '../domain/types.js';

const EMIT_CLAIMS = 'emit_claims';
const emitClaimsTool: ToolDef = {
	name: EMIT_CLAIMS,
	description:
		'Return the atomic, testable claims extracted from the narrative.',
	input_schema: {
		type: 'object',
		properties: {
			claims: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						text: { type: 'string' },
						type: {
							enum: [
								'presence',
								'absence',
								'exclusivity',
								'qualitative',
							],
						},
					},
					required: ['text', 'type'],
				},
			},
		},
		required: ['claims'],
	},
};

export async function normalize(
	containerId: string,
	narrative: string
): Promise<Claim[]> {
	const response = await callLlm({
		system: normalizeSystemPrompt(EMIT_CLAIMS),
		tools: [emitClaimsTool],
		forceTool: EMIT_CLAIMS,
		messages: [{ role: 'user', content: narrative }],
	});

	const toolUse = response.content.find(
		(b): b is Extract<typeof b, { type: 'tool_use' }> =>
			b.type === 'tool_use'
	);
	if (!toolUse) throw new Error(`LLM did not call ${EMIT_CLAIMS}`);

	const parsed = LlmClaimsOutputSchema.parse(toolUse.input);

	return parsed.claims.map((c, i) => ({
		id: `${containerId}.n${i + 1}`,
		text: c.text,
		type: c.type,
	}));
}
