import type { LlmBlock } from './types.js';

/** Extracts the JSON-only response required by the LLM system prompts. */
export class LlmJsonResponseParser {
	parse(blocks: LlmBlock[]): unknown {
		const text = blocks
			.filter(
				(block): block is Extract<LlmBlock, { type: 'text' }> =>
					block.type === 'text'
			)
			.map((block) => block.text)
			.join('\n')
			.trim();

		if (!text) throw new Error('LLM returned no JSON text.');
		return JSON.parse(text);
	}
}
