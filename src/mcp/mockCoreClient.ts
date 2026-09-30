import fs from "node:fs";
import type { CoreClient, ToolCallResult } from "./types.js";
import {
  CODE_ANATOMY_TOOLS,
  TOOL_IMPLEMENTATION,
  TOOL_REFERENCES,
  TOOL_SKELETON,
} from "./codeAnatomy.js";

interface FixtureSymbol {
  id: string;
  kind: string;
  doc?: string;
  signature?: string;
  calls?: string[];
  calledBy?: string[];
  lines?: [number, number];
  code?: string;
}

interface FixtureFile {
  path: string;
  symbols: FixtureSymbol[];
}

interface Fixture {
  containers: Record<string, { files: FixtureFile[] }>;
}

function loadFixture(path: string): Fixture {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function findSymbol(fx: Fixture, containerId: string, symbolId: string) {
  const container = fx.containers[containerId];
  if (!container) return undefined;
  for (const file of container.files) {
    const symbol = file.symbols.find((s) => s.id === symbolId);
    if (symbol) return { file, symbol };
  }
  return undefined;
}

const nameOf = (id: string): string => id.slice(id.indexOf("#") + 1).split(".").pop() ?? id;
const fileOf = (id: string): string => id.slice(0, id.indexOf("#"));

export function createMockCoreClient(fixturePath: string): CoreClient {
  const fixture = loadFixture(fixturePath);

  async function callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    const containerId = String(args.containerId ?? "");

    switch (name) {
      case TOOL_SKELETON: {
        const container = fixture.containers[containerId];
        if (!container) return { content: { files: [] } };
        return {
          content: {
            files: container.files.map((f) => ({
              path: f.path,
              symbols: f.symbols.map((s) => ({
                id: s.id,
                type: s.kind,
                datatype: s.signature ?? "",
                modifiers: [],
              })),
            })),
          },
        };
      }

      case TOOL_IMPLEMENTATION: {
        const symbolId = String(args.symbolId ?? "");
        const hit = findSymbol(fixture, containerId, symbolId);
        if (!hit) return { content: { error: `Unknown symbolId "${symbolId}"`, symbolId } };
        if (!hit.symbol.code) {
          return { content: { error: "no implementation body available for this symbol", symbolId } };
        }
        return { content: { symbolId, body: hit.symbol.code.split("\n") } };
      }

      case TOOL_REFERENCES: {
        const symbolId = String(args.symbolId ?? "");
        const hit = findSymbol(fixture, containerId, symbolId);
        if (!hit) return { content: { error: `Unknown symbolId "${symbolId}"`, symbolId } };
        return {
          content: {
            symbolId,
            references: (hit.symbol.calledBy ?? []).map((id) => ({
              id,
              source: fileOf(id),
              name: nameOf(id),
              type: "method",
              lineNumber: 0,
            })),
            note: "References are matched by symbol NAME across every repository Core stores, not only this container. Check each source path.",
          },
        };
      }

      default:
        return { content: { error: `unknown tool: ${name}` } };
    }
  }

  return { tools: CODE_ANATOMY_TOOLS, callTool, close: async () => {} };
}
