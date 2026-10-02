import { llmClient, type ILllmClient } from '../llm/client.js';
import { prompts } from '../llm/prompts.js';
import { LlmClaimsOutputSchema } from '../domain/schemas.js';
import type { Claim } from '../domain/types.js';
import { LlmJsonResponseParser } from '../llm/jsonResponse.js';

export class ClaimNormalizer {
	constructor(
		private readonly client: ILllmClient = llmClient,
		private readonly responseParser = new LlmJsonResponseParser()
	) {}

	async normalize(appName: string, narrative: string): Promise<Claim[]> {
		const response = await this.client.complete({
			system: prompts.normalizeSystem(),
			messages: [{ role: 'user', content: narrative }],
		});

		const parsed = LlmClaimsOutputSchema.parse(
			this.responseParser.parse(response.content)
		);

		return parsed.claims.map((c, i) => ({
			id: `${appName}.n${i + 1}`,
			text: c.text,
			type: c.type,
		}));
	}
}
