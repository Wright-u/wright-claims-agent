import { describe, it, expect } from "vitest";
import {
  SymbolRegistry,
  shapeSkeleton,
  shapeReferences,
  shapeImplementation,
  resolveSymbolUrl,
  unwrapResult,
} from "../../src/mcp/codeAnatomy.js";
import { collectEvidence } from "../../src/verify/validator.js";

const rawSkeleton = {
  files: [
    {
      path: "prototype/Svc.cs",
      signatures: [
        {
          name: "Wright.Svc",
          type: "namespace",
          datatype: "",
          modifiers: [],
          internals: [
            {
              name: "FooService",
              type: "class",
              datatype: "",
              modifiers: ["public"],
              internals: [
                { name: "Create", type: "method", datatype: "Task<Foo>", modifiers: ["public", "async"], internals: [] },
                { name: "Create", type: "method", datatype: "Task<Foo>", modifiers: [], internals: [] },
              ],
            },
          ],
        },
      ],
    },
    { path: "prototype/README.md", signatures: [] },
  ],
};

describe("shapeSkeleton", () => {
  it("flattens, drops empty files, builds citable unique ids and registers urls", () => {
    const reg = new SymbolRegistry();
    const out = shapeSkeleton(rawSkeleton, reg);
    expect(out.files).toHaveLength(1);
    const ids = out.files[0].symbols.map((s) => s.id);
    expect(ids).toEqual([
      "prototype/Svc.cs#Wright.Svc",
      "prototype/Svc.cs#Wright.Svc.FooService",
      "prototype/Svc.cs#Wright.Svc.FooService.Create",
      "prototype/Svc.cs#Wright.Svc.FooService.Create_2",
    ]);
    expect(reg.urlFor(ids[2])).toBe("prototype/Svc.cs/Wright.Svc/FooService/Create");

    const seen = new Set<string>();
    collectEvidence(JSON.stringify(out), seen);
    for (const id of ids) expect(seen.has(id)).toBe(true); // validator can see every id
  });

  it("falls back to dot-splitting for ids not in the registry", () => {
    expect(resolveSymbolUrl(new SymbolRegistry(), "a/b.cs#P.M")).toBe("a/b.cs/P/M");
    expect(resolveSymbolUrl(new SymbolRegistry(), "nonsense")).toBeUndefined();
  });
});

describe("other shapers", () => {
  it("shapes implementation and references (PascalCase tolerated)", () => {
    expect(shapeImplementation("x#y", { Body: ["a;", "b;"] }).body).toEqual(["a;", "b;"]);

    const reg = new SymbolRegistry();
    shapeSkeleton(rawSkeleton, reg);
    const refs = shapeReferences(
      "x#y",
      { references: [{ source: "prototype/Svc.cs", signature: { name: "FooService", type: "class" }, lineNumber: 12 }] },
      reg
    );
    expect(refs.references[0]).toMatchObject({
      id: "prototype/Svc.cs#Wright.Svc.FooService",
      lineNumber: 12,
    });
  });

  it("unwraps structured content, text JSON, and errors", () => {
    expect(unwrapResult({ structuredContent: { a: 1 } }).data).toEqual({ a: 1 });
    expect(unwrapResult({ content: [{ type: "text", text: '{"b":2}' }] }).data).toEqual({ b: 2 });
    expect(unwrapResult({ isError: true, content: [{ type: "text", text: "boom" }] }).error).toBe("boom");
  });
});
