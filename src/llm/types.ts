export interface ToolDef {
	name: string;
	description: string;
	input_schema: Record<string, unknown>;
}

export type LlmBlock =
	| { type: 'text'; text: string }
	| {
			type: 'tool_use';
			id: string;
			name: string;
			input: Record<string, unknown>;
	  }
	| {
			type: 'tool_result';
			tool_use_id: string;
			content: string;
			is_error?: boolean;
	  };

export interface LlmMessage {
	role: 'user' | 'assistant';
	content: string | LlmBlock[];
}

export interface LlmResponse {
	content: LlmBlock[];
}

export interface LlmCallOptions {
	system: string;
	tools: ToolDef[];
	messages: LlmMessage[];
	forceTool?: string;
	maxTokens?: number;
}
