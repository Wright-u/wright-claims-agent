import fs from "node:fs";
import type { CoreClient, CoreTool, ToolCallResult } from "./types.js";

interface FixtureSymbol {
  id: string;
  kind: string;
  doc: string;
  signature?: string;
  calls?: string[];
  calledBy?: string[];
  externalCalls?: { kind: string; address: string }[];
  flags?: Record<string, boolean>;
  lines?: [number, number];
  code?: string;
}

interface FixtureFile {
  path: string;
  symbols: FixtureSymbol[];
}

interface FixtureEdge {
  source: string;
  target: string;
  kind: string;
  evidence: string[];
}

interface Fixture {
  containers: Record<string, { files: FixtureFile[] }>;
  edges: FixtureEdge[];
}

const PLACEHOLDER_TOOLS: CoreTool[] = [
  {
    name: "get_outline",
    description: "List files and top-level symbols (names + docs only) for a container.",
    inputSchema: {
      type: "object",
      properties: { containerId: { type: "string" }, path: { type: "string" } },
      required: ["containerId"],
    },
  },
  {
    name: "find_symbols",
    description: "Search a container's symbols by keyword (name/doc/signature). Max 10 matches.",
    inputSchema: {
      type: "object",
      properties: { containerId: { type: "string" }, query: { type: "string" } },
      required: ["containerId", "query"],
    },
  },
  {
    name: "get_symbol",
    description: "Get one symbol's signature, doc, calls, callers, external calls and flags.",
    inputSchema: {
      type: "object",
      properties: { containerId: { type: "string" }, symbolId: { type: "string" } },
      required: ["containerId", "symbolId"],
    },
  },
  {
    name: "get_edges",
    description: "Container-to-container relationships already extracted for C2.",
    inputSchema: {
      type: "object",
      properties: { source: { type: "string" }, target: { type: "string" } },
    },
  },
  {
    name: "request_code",
    description: "Read the real source of one symbol (max ~60 lines). Requires a reason.",
    inputSchema: {
      type: "object",
      properties: {
        containerId: { type: "string" },
        symbolId: { type: "string" },
        reason: { type: "string" },
      },
      required: ["containerId", "symbolId", "reason"],
    },
  },
];

function loadFixture(path: string): Fixture {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function allSymbols(fx: Fixture, containerId: string): FixtureSymbol[] {
  const container = fx.containers[containerId];
  if (!container) return [];
  return container.files.flatMap((f) => f.symbols);
}

function findSymbol(fx: Fixture, containerId: string, symbolId: string): FixtureSymbol | undefined {
  return allSymbols(fx, containerId).find((s) => s.id === symbolId);
}

export function createMockCoreClient(fixturePath: string): CoreClient {
  const fixture = loadFixture(fixturePath);

  async function callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    switch (name) {
      case "get_outline": {
        const containerId = args.containerId as string;
        const container = fixture.containers[containerId];
        if (!container) return { content: { files: [] } };
        const files = container.files.map((f) => ({
          path: f.path,
          symbols: f.symbols.map((s) => ({ id: s.id, kind: s.kind, doc: s.doc })),
        }));
        return { content: { files } };
      }

      case "find_symbols": {
        const containerId = args.containerId as string;
        const query = String(args.query ?? "").toLowerCase();
        const matches = allSymbols(fixture, containerId)
          .filter(
            (s) =>
              s.id.toLowerCase().includes(query) ||
              s.doc.toLowerCase().includes(query) ||
              (s.signature ?? "").toLowerCase().includes(query)
          )
          .slice(0, 10)
          .map((s) => ({ id: s.id, kind: s.kind, signature: s.signature ?? "", doc: s.doc }));
        return { content: { matches } };
      }

      case "get_symbol": {
        const containerId = args.containerId as string;
        const symbolId = args.symbolId as string;
        const sym = findSymbol(fixture, containerId, symbolId);
        if (!sym) return { content: { error: "symbol not found in this container" } };
        return {
          content: {
            signature: sym.signature ?? "",
            doc: sym.doc,
            calls: sym.calls ?? [],
            calledBy: sym.calledBy ?? [],
            externalCalls: sym.externalCalls ?? [],
            flags: sym.flags ?? {},
          },
        };
      }

      case "get_edges": {
        const source = args.source as string | undefined;
        const target = args.target as string | undefined;
        const edges = fixture.edges.filter(
          (e) => (!source || e.source === source) && (!target || e.target === target)
        );
        return { content: { edges } };
      }

      case "request_code": {
        const containerId = args.containerId as string;
        const symbolId = args.symbolId as string;
        const sym = findSymbol(fixture, containerId, symbolId);
        if (!sym || !sym.code || !sym.lines) {
          return { content: { error: "no code available for this symbol in the fixture" } };
        }
        return { content: { symbolId, lines: sym.lines, code: sym.code } };
      }

      default:
        return { content: { error: `unknown tool: ${name}` } };
    }
  }

  return {
    tools: PLACEHOLDER_TOOLS,
    callTool,
    close: async () => {},
  };
}
