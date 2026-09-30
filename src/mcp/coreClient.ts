import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { config } from "../config.js";
import type { CoreClient, CoreTool } from "./types.js";

export async function createMcpCoreClient(): Promise<CoreClient> {
  const client = new Client({ name: "wright-claims-agent", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(config.CORE_MCP_URL), {
    requestInit: {
      headers: config.CORE_API_KEY
        ? { Authorization: `Bearer ${config.CORE_API_KEY}` }
        : {},
    },
  });
  await client.connect(transport);

  const { tools } = await client.listTools();

  return {
    tools: tools as CoreTool[],
    callTool: async (name, args) => {
      const result = await client.callTool({ name, arguments: args });
      return { content: result.content };
    },
    close: () => client.close(),
  };
}
