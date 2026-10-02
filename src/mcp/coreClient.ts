import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { config } from "../config.js";
import type { CoreClient, CoreTool, ToolCallResult } from "./types.js";
import { unwrapResult, type RawCallResult } from "./unwrap.js";

function describeConnectError(err: unknown, url: string): string {
  const e = err as { message?: string; code?: number | string; cause?: { code?: string; message?: string } };
  const cause = e?.cause?.code ?? e?.cause?.message ?? e?.code ?? "";
  const hint: Record<string, string> = {
    ECONNREFUSED: "Core is not running on that host/port, or localhost resolves to a different IP family than Core listens on (try 127.0.0.1).",
    ENOTFOUND: "Host name could not be resolved. Check CORE_MCP_URL.",
    ETIMEDOUT: "Connection timed out. Check firewall / host.",
    DEPTH_ZERO_SELF_SIGNED_CERT: "Core's HTTPS dev certificate is not trusted. Use the http profile or trust the cert.",
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: "Core's HTTPS certificate is not trusted. Use the http profile or trust the cert.",
    SELF_SIGNED_CERT_IN_CHAIN: "Core's HTTPS certificate is not trusted. Use the http profile or trust the cert.",
  };
  const extra = typeof cause === "string" ? hint[cause] ?? "" : "";
  return `Cannot reach Core MCP server at ${url}: ${e?.message ?? "connect failed"}${cause ? ` (${cause})` : ""}${extra ? ` - ${extra}` : ""}`;
}

export async function createMcpCoreClient(): Promise<CoreClient> {
  const client = new Client({ name: "wright-claims-agent", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(config.CORE_MCP_URL), {
    requestInit: {
      headers: config.CORE_API_KEY ? { Authorization: `Bearer ${config.CORE_API_KEY}` } : {},
    },
  });

  try {
    await client.connect(transport);
  } catch (err) {
    throw new Error(describeConnectError(err, config.CORE_MCP_URL));
  }

  // Discover tools
  const tools: CoreTool[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.listTools(cursor ? { cursor } : undefined);
    for (const t of page.tools) {
      tools.push({
        name: t.name,
        description: t.description ?? "",
        inputSchema: (t.inputSchema ?? { type: "object", properties: {} }) as Record<string, unknown>,
      });
    }
    cursor = page.nextCursor;
  } while (cursor);

  if (tools.length === 0) {
    await client.close();
    throw new Error(`Core MCP server at ${config.CORE_MCP_URL} published no tools (tools/list was empty).`);
  }

  const callTool = async (name: string, args: Record<string, unknown>): Promise<ToolCallResult> => {
    const result = (await client.callTool({ name, arguments: args })) as RawCallResult;
    const { data, error } = unwrapResult(result);
    return { content: error !== undefined ? { error } : data };
  };

  return { tools, callTool, close: () => client.close() };
}
