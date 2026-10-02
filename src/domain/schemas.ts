import { z } from 'zod';

export const ClaimTypeSchema = z.enum([
	'presence',
	'absence',
	'exclusivity',
	'qualitative',
]);

export const ClaimSchema = z.object({
	id: z.string(),
	text: z.string().min(1),
	type: ClaimTypeSchema,
});

export const VerdictSchema = z.enum([
	'supported',
	'contradicted',
	'not_found',
	'undetermined',
]);

export const VerifyRequestSchema = z.object({
	appName: z.string().min(1),
	narrative: z.string().min(1),
});

const VerifyResultSchema = z.object({
	claimId: z.string(),
	verdict: VerdictSchema,
	reasoning: z.string(),
	evidence: z.array(z.string()),
	rounds: z.number().int(),
	codeRequests: z.number().int(),
	trace: z.array(
		z.object({
			round: z.number().int(),
			tool: z.string(),
			args: z.record(z.unknown()),
			resultSummary: z.string(),
		})
	),
});

export const VerifyResponseSchema = z.object({
	claims: z.array(ClaimSchema),
	results: z.array(VerifyResultSchema),
});

// What the LLM must return when asked to emit claims
export const LlmClaimsOutputSchema = z.object({
	claims: z.array(
		z.object({
			text: z.string(),
			type: ClaimTypeSchema,
		})
	),
});

// What the LLM must return when submitting a verdict
export const LlmVerdictOutputSchema = z.object({
	verdict: VerdictSchema.exclude(['undetermined']).or(z.literal('unknown')),
	reasoning: z.string(),
	evidence: z.array(z.string()),
});
