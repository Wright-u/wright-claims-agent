// Turns an MCP tools/call result into plain data
type Obj = Record<string, unknown>;
export interface RawCallResult {
	isError?: boolean;
	structuredContent?: unknown;
	content?: unknown;
}

export class McpResultUnwrapper {
	unwrap(result: RawCallResult): { data?: unknown; error?: string } {
		const blocks = Array.isArray(result.content)
			? (result.content as Obj[])
			: [];
		const text = blocks
			.filter((b) => b?.type === 'text' && typeof b.text === 'string')
			.map((b) => b.text as string)
			.join('\n');

		if (result.isError) return { error: text || 'Tool call failed' };
		if (
			result.structuredContent !== undefined &&
			result.structuredContent !== null
		) {
			return { data: result.structuredContent };
		}
		if (!text) return { data: null };
		try {
			return { data: JSON.parse(text) };
		} catch {
			return { data: text };
		}
	}
}
