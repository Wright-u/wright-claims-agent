/**
 *   getAppSkeleton {containerId}      -> getAppSkeleton   <containerId via CORE_APP_URL_TEMPLATE>
 *   getImplementation {symbolId}      -> getImplementation <file>/<parent>/<method>
 *   getSymbolReferences {symbolId}    -> getSymbolReferences <file>/<parent>/<method>
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { config } from "../config.js";
import type { CoreClient, ToolCallResult } from "./types.js";
import {
  CODE_ANATOMY_TOOLS,
  SymbolRegistry,
  TOOL_IMPLEMENTATION,
  TOOL_REFERENCES,
  TOOL_SKELETON,
  resolveSymbolUrl,
  shapeImplementation,
  shapeReferences,
  shapeSkeleton,
  unwrapResult,
  type RawCallResult,
} from "./codeAnatomy.js";

export async function createMcpCoreClient(): Promise<CoreClient> {
  const client = new Client({ name: "wright-claims-agent", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(config.CORE_MCP_URL), {
    requestInit: {
      headers: config.CORE_API_KEY ? { Authorization: `Bearer ${config.CORE_API_KEY}` } : {},
    },
  });
  await client.connect(transport);

  const { tools: published } = await client.listTools();
  const publishedNames = new Set(published.map((t) => t.name));
  const missing = [TOOL_SKELETON, TOOL_IMPLEMENTATION, TOOL_REFERENCES].filter(
    (n) => !publishedNames.has(n)
  );
  if (missing.length > 0) {
    await client.close();
    throw new Error(
      `Core MCP server at ${config.CORE_MCP_URL} does not publish expected tools: ${missing.join(", ")}. ` +
        `Published: ${[...publishedNames].join(", ") || "(none)"}`
    );
  }

  const registry = new SymbolRegistry();

  const callCore = async (name: string, url: string): Promise<{ data?: unknown; error?: string }> => {
    const result = (await client.callTool({ name, arguments: { url } })) as RawCallResult;
    return unwrapResult(result);
  };

  const callTool = async (name: string, args: Record<string, unknown>): Promise<ToolCallResult> => {
    switch (name) {
      case TOOL_SKELETON: {
        const containerId = String(args.containerId ?? "");
        if (!containerId) return { content: { error: "containerId is required" } };
        const url = config.CORE_APP_URL_TEMPLATE.replaceAll("{containerId}", containerId);
        const { data, error } = await callCore(TOOL_SKELETON, url);
        if (error) return { content: { error } };
        return { content: shapeSkeleton(data, registry) };
      }

      case TOOL_IMPLEMENTATION:
      case TOOL_REFERENCES: {
        const symbolId = String(args.symbolId ?? "");
        const url = resolveSymbolUrl(registry, symbolId);
        if (!url) {
          return {
            content: {
              error: `Unknown symbolId "${symbolId}". Use an id returned by getAppSkeleton (format: <file path>#<Parent>.<Name>).`,
            },
          };
        }
        const { data, error } = await callCore(name, url);
        if (error) return { content: { error, symbolId } };
        return {
          content:
            name === TOOL_IMPLEMENTATION
              ? shapeImplementation(symbolId, data)
              : shapeReferences(symbolId, data, registry),
        };
      }

      default:
        return { content: { error: `unknown tool: ${name}` } };
    }
  };

  return {
    tools: CODE_ANATOMY_TOOLS,
    callTool,
    close: () => client.close(),
  };
}
