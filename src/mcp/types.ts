/**
 *  - mockCoreClient.ts   -> fixture-driven
 *  - coreClient.ts       -> real MCP client
 * Swapping is one line in config (CORE_MODE=mock|mcp)
 */

export interface CoreTool {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

export interface ToolCallResult {
	content: unknown;
}

export interface CoreClient {
	tools: CoreTool[];
	callTool(
		name: string,
		args: Record<string, unknown>
	): Promise<ToolCallResult>;
	close(): Promise<void>;
}
