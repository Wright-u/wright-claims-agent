import Groq from 'groq-sdk';
import { config } from '../config.js';
import type {
	LlmBlock,
	LlmCallOptions,
	LlmMessage,
	LlmResponse,
	ToolDef,
} from './types.js';

const groq = new Groq({ apiKey: config.LLM_API_KEY });

//our internal message/tool shape -> Groq (OpenAI-compatible) shape ---

function toGroqTools(tools: ToolDef[]) {
	return tools.map((t) => ({
		type: 'function' as const,
		function: {
			name: t.name,
			description: t.description,
			parameters: t.input_schema,
		},
	}));
}

function toGroqMessages(system: string, messages: LlmMessage[]) {
	const out: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
		{ role: 'system', content: system },
	];

	for (const m of messages) {
		if (typeof m.content === 'string') {
			out.push({ role: m.role, content: m.content });
			continue;
		}

		if (m.role === 'user') {
			// user-turn blocks are always tool_result blocks in our loop
			for (const block of m.content) {
				if (block.type !== 'tool_result') continue;
				const content = block.is_error
					? `ERROR: ${block.content}`
					: block.content;
				out.push({
					role: 'tool',
					tool_call_id: block.tool_use_id,
					content,
				});
			}
			continue;
		}

		// assistant-turn blocks: text and/or tool_use
		const textBlocks = m.content.filter(
			(b): b is Extract<LlmBlock, { type: 'text' }> => b.type === 'text'
		);
		const toolUseBlocks = m.content.filter(
			(b): b is Extract<LlmBlock, { type: 'tool_use' }> =>
				b.type === 'tool_use'
		);

		out.push({
			role: 'assistant',
			content: textBlocks.map((b) => b.text).join('\n') || null,
			tool_calls: toolUseBlocks.length
				? toolUseBlocks.map((tc) => ({
						id: tc.id,
						type: 'function' as const,
						function: {
							name: tc.name,
							arguments: JSON.stringify(tc.input),
						},
					}))
				: undefined,
		});
	}

	return out;
}

// --- Groq response -> our internal shape ---

function fromGroqMessage(
	message: Groq.Chat.Completions.ChatCompletionMessage
): LlmResponse {
	const content: LlmBlock[] = [];

	if (message.content) {
		content.push({ type: 'text', text: message.content });
	}
	for (const tc of message.tool_calls ?? []) {
		let input: Record<string, unknown> = {};
		try {
			input = JSON.parse(tc.function.arguments);
		} catch {
			// malformed JSON from the model — leave input empty, the caller's
			// validation (e.g. checkVerdict) will reject/retry as appropriate
		}
		content.push({
			type: 'tool_use',
			id: tc.id,
			name: tc.function.name,
			input,
		});
	}

	return { content };
}

export async function callLlm(opts: LlmCallOptions): Promise<LlmResponse> {
	const completion = await groq.chat.completions.create({
		model: config.LLM_MODEL,
		max_tokens: opts.maxTokens ?? 1500,
		messages: toGroqMessages(opts.system, opts.messages),
		tools: opts.tools.length ? toGroqTools(opts.tools) : undefined,
		tool_choice: opts.forceTool
			? { type: 'function', function: { name: opts.forceTool } }
			: opts.tools.length
				? 'auto'
				: undefined,
	});

	const message = completion.choices[0]?.message;
	if (!message) throw new Error('Groq returned no choices');
	return fromGroqMessage(message);
}
