//adapter
import type { CoreTool } from "./types.js";
export const TOOL_SKELETON = "getAppSkeleton";
export const TOOL_IMPLEMENTATION = "getImplementation";
export const TOOL_REFERENCES = "getSymbolReferences";

export const MAX_OUTLINE_SYMBOLS = 300;


export const CODE_ANATOMY_TOOLS: CoreTool[] = [
  {
    name: TOOL_SKELETON,
    description:
      "List every source file of the container with its symbols (classes, methods, fields...): " +
      "id, type, datatype and modifiers. Signatures only — no bodies and no doc comments.",
    inputSchema: {
      type: "object",
      properties: { containerId: { type: "string" } },
      required: ["containerId"],
    },
  },
  {
    name: TOOL_IMPLEMENTATION,
    description:
      "Read the implementation body (statements) of ONE method. symbolId must be an id returned by " +
      "getAppSkeleton or getSymbolReferences. Costs a code request; say why you need it.",
    inputSchema: {
      type: "object",
      properties: {
        containerId: { type: "string" },
        symbolId: { type: "string", description: "e.g. app/src/Foo.cs#FooService.Create" },
      },
      required: ["containerId", "symbolId"],
    },
  },
  {
    name: TOOL_REFERENCES,
    description:
      "Find where a symbol name is referenced (caller side): the enclosing symbol, file and line of each " +
      "reference. Matching is by NAME across Core's whole repository store, so check each source path.",
    inputSchema: {
      type: "object",
      properties: {
        containerId: { type: "string" },
        symbolId: { type: "string" },
      },
      required: ["containerId", "symbolId"],
    },
  },
];


type Obj = Record<string, unknown>;

function pick<T = unknown>(o: unknown, key: string): T | undefined {
  if (!o || typeof o !== "object") return undefined;
  const r = o as Obj;
  const pascal = key.charAt(0).toUpperCase() + key.slice(1);
  return (r[key] ?? r[pascal]) as T | undefined;
}

function arr(o: unknown, key: string): unknown[] {
  const v = pick<unknown>(o, key);
  return Array.isArray(v) ? v : [];
}

function str(o: unknown, key: string): string {
  const v = pick<unknown>(o, key);
  return typeof v === "string" ? v : "";
}


export class SymbolRegistry {
  private urlById = new Map<string, string>();
  private idByFileAndName = new Map<string, string>();

  add(id: string, url: string, filePath: string, name: string): void {
    this.urlById.set(id, url);
    const key = `${filePath}#${name}`;
    if (!this.idByFileAndName.has(key)) this.idByFileAndName.set(key, id);
  }

  urlFor(symbolId: string): string | undefined {
    return this.urlById.get(symbolId);
  }

  idFor(filePath: string, name: string): string | undefined {
    return this.idByFileAndName.get(`${filePath}#${name}`);
  }

  get size(): number {
    return this.urlById.size;
  }
}

/** ids must stay within [\w.] after the '#', so evidence collection can see them. */
function sanitize(name: string): string {
  return name.replace(/[^\w.]/g, "_") || "_";
}


export function fallbackUrl(symbolId: string): string | undefined {
  const hash = symbolId.indexOf("#");
  if (hash < 1 || hash === symbolId.length - 1) return undefined;
  const file = symbolId.slice(0, hash);
  const chain = symbolId.slice(hash + 1).split(".").filter(Boolean);
  return [file, ...chain].join("/");
}

export function resolveSymbolUrl(registry: SymbolRegistry, symbolId: string): string | undefined {
  return registry.urlFor(symbolId) ?? fallbackUrl(symbolId);
}

// Response shaping

export interface OutlineSymbol {
  id: string;
  type: string;
  datatype: string;
  modifiers: string[];
}

export interface OutlineFile {
  path: string;
  symbols: OutlineSymbol[];
}

export function shapeSkeleton(raw: unknown, registry: SymbolRegistry): {
  files: OutlineFile[];
  truncated?: boolean;
  note?: string;
} {
  const files: OutlineFile[] = [];
  const usedIds = new Set<string>();
  let count = 0;
  let truncated = false;

  const uniqueId = (base: string): string => {
    let id = base;
    let n = 2;
    while (usedIds.has(id)) id = `${base}_${n++}`;
    usedIds.add(id);
    return id;
  };

  const walk = (
    sigs: unknown[],
    filePath: string,
    chain: string[],
    out: OutlineSymbol[]
  ): void => {
    for (const sig of sigs) {
      if (count >= MAX_OUTLINE_SYMBOLS) {
        truncated = true;
        return;
      }
      const name = str(sig, "name");
      if (!name) continue;
      const nextChain = [...chain, name];
      const id = uniqueId(`${filePath}#${nextChain.map(sanitize).join(".")}`);
      registry.add(id, [filePath, ...nextChain].join("/"), filePath, name);
      out.push({
        id,
        type: str(sig, "type"),
        datatype: str(sig, "datatype"),
        modifiers: arr(sig, "modifiers").filter((m): m is string => typeof m === "string"),
      });
      count++;
      walk(arr(sig, "internals"), filePath, nextChain, out);
    }
  };

  for (const file of arr(raw, "files")) {
    const path = str(file, "path");
    const sigs = arr(file, "signatures");
    if (!path || sigs.length === 0) continue; // skip non-code / unparsed files
    const symbols: OutlineSymbol[] = [];
    walk(sigs, path, [], symbols);
    if (symbols.length > 0) files.push({ path, symbols });
    if (truncated) break;
  }

  return truncated
    ? { files, truncated: true, note: `Outline capped at ${MAX_OUTLINE_SYMBOLS} symbols; use getSymbolReferences to explore further.` }
    : { files };
}

export function shapeImplementation(symbolId: string, raw: unknown): { symbolId: string; body: string[] } {
  return {
    symbolId,
    body: arr(raw, "body").filter((s): s is string => typeof s === "string"),
  };
}

export function shapeReferences(symbolId: string, raw: unknown, registry: SymbolRegistry) {
  const references = arr(raw, "references").map((ref) => {
    const source = str(ref, "source");
    const sig = pick<unknown>(ref, "signature");
    const name = str(sig, "name");
    const id =
      registry.idFor(source, name) ?? (source && name ? `${source}#${sanitize(name)}` : source);
    return {
      id,
      source,
      name,
      type: str(sig, "type"),
      lineNumber: Number(pick<unknown>(ref, "lineNumber") ?? 0),
    };
  });
  return {
    symbolId,
    references,
    note: "References are matched by symbol NAME across every repository Core stores, not only this container. Check each source path.",
  };
}


export interface RawCallResult {
  isError?: boolean;
  structuredContent?: unknown;
  content?: unknown;
}

export function unwrapResult(result: RawCallResult): { data?: unknown; error?: string } {
  const blocks = Array.isArray(result.content) ? (result.content as Obj[]) : [];
  const text = blocks
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");

  if (result.isError) return { error: text || "Core tool call failed" };
  if (result.structuredContent !== undefined && result.structuredContent !== null) {
    return { data: result.structuredContent };
  }
  try {
    return { data: JSON.parse(text) };
  } catch {
    return { error: text ? `Unparseable Core response: ${text.slice(0, 200)}` : "Empty Core response" };
  }
}
