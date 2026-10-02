import fs from "node:fs";
import type { CoreClient, CoreTool, ToolCallResult } from "./types.js";

interface FixtureSymbol {
  id: string; // "<file path>#<Parent>.<Name>"
  kind: string;
  signature?: string;
  code?: string;
  calledBy?: string[];
}
interface FixtureFile {
  path: string;
  symbols: FixtureSymbol[];
}
interface Fixture {
  containers: Record<string, { files: FixtureFile[] }>;
}

const urlSchema = (description: string): Record<string, unknown> => ({
  type: "object",
  properties: { url: { type: "string", description } },
  required: ["url"],
});

const MOCK_TOOLS: CoreTool[] = [
  {
    name: "getAppSkeleton",
    description: "Retrieves all the files content signatures of a given app",
    inputSchema: urlSchema("URL of the repository of the app"),
  },
  {
    name: "getImplementation",
    description: "Get the implementation body of a method",
    inputSchema: urlSchema(
      "URL of the method in the app. Example: <repo_url>/<file_name>/<parent_container_if_any>/<method_name>"
    ),
  },
  {
    name: "getSymbolReferences",
    description: "Get the symbol references of a method",
    inputSchema: urlSchema(
      "URL of the method in the app. Example: <repo_url>/<file_name>/<parent_container_if_any>/<method_name>"
    ),
  },
];

interface Sig {
  name: string;
  type: string;
  datatype: string;
  modifiers: string[];
  internals: Sig[];
}

function buildSignatures(symbols: FixtureSymbol[]): Sig[] {
  const roots: Sig[] = [];
  for (const s of symbols) {
    const chain = s.id.slice(s.id.indexOf("#") + 1).split(".");
    let level = roots;
    chain.forEach((name, i) => {
      let node = level.find((n) => n.name === name);
      if (!node) {
        node = { name, type: i === chain.length - 1 ? s.kind : "class", datatype: "", modifiers: [], internals: [] };
        level.push(node);
      }
      if (i === chain.length - 1) {
        node.type = s.kind;
        node.datatype = s.signature ?? "";
      }
      level = node.internals;
    });
  }
  return roots;
}

function resolveMethodUrl(fx: Fixture, url: string): { file: FixtureFile; symbol: FixtureSymbol } | undefined {
  for (const container of Object.values(fx.containers)) {
    for (const file of container.files) {
      if (!url.startsWith(file.path + "/")) continue;
      const chain = url.slice(file.path.length + 1).split("/").filter(Boolean).join(".");
      const symbol = file.symbols.find((s) => s.id === `${file.path}#${chain}`);
      if (symbol) return { file, symbol };
    }
  }
  return undefined;
}

export function createMockCoreClient(fixturePath: string): CoreClient {
  const fixture: Fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

  async function callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    const url = String(args.url ?? "").replace(/\/+$/, "");

    switch (name) {
      case "getAppSkeleton": {
        const container = fixture.containers[url];
        if (!container) return { content: { error: `Directory not found: ${url}` } };
        return {
          content: {
            files: container.files.map((f) => ({ path: f.path, signatures: buildSignatures(f.symbols) })),
          },
        };
      }

      case "getImplementation": {
        const hit = resolveMethodUrl(fixture, url);
        if (!hit) return { content: { error: `Could not find the declaration at ${url}` } };
        if (!hit.symbol.code) return { content: { error: "The declaration has no body" } };
        return { content: { body: hit.symbol.code.split("\n") } };
      }

      case "getSymbolReferences": {
        const hit = resolveMethodUrl(fixture, url);
        if (!hit) return { content: { error: `Could not find the declaration at ${url}` } };
        return {
          content: {
            references: (hit.symbol.calledBy ?? []).map((id) => {
              const source = id.slice(0, id.indexOf("#"));
              const chain = id.slice(id.indexOf("#") + 1).split(".");
              return {
                source,
                signature: { name: chain[chain.length - 1], type: "method", datatype: "", modifiers: [], internals: [] },
                lineNumber: 1,
              };
            }),
          },
        };
      }

      default:
        return { content: { error: `unknown tool: ${name}` } };
    }
  }

  return { tools: MOCK_TOOLS, callTool, close: async () => {} };
}