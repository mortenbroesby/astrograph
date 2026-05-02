import { describe, expect, it } from "vitest";

import { parseSourceFile } from "../src/parser.ts";

describe("astrograph parser golden coverage", () => {
  it("extracts the accepted tree-sitter-only parser baseline", () => {
    const parsed = parseSourceFile({
      relativePath: "src/parser-fixture.ts",
      language: "ts",
      content: `
export const toolkit = {
  build: () => "build",
  format() {
    return "format";
  },
  legacy: function () {
    return "legacy";
  },
};

class Service {
  constructor() {}
  get status() {
    return "ok";
  }
  set status(value: string) {
    void value;
  }
  ready = true;
  run() {
    return this.status;
  }
}

export { Service };
export { depThing as aliasedThing } from "./dep";

export default function () {
  return "default";
}

export namespace Shapes {
  export function area() {
    return 1;
  }
}
`,
    });

    expect(parsed.backend).toBe("tree-sitter");
    expect(parsed.fallbackUsed).toBe(false);
    expect(parsed.imports.map((entry) => entry.source)).toContain("./dep");
    expect(parsed.symbols.map((symbol) => ({
      name: symbol.name,
      qualifiedName: symbol.qualifiedName,
      kind: symbol.kind,
      exported: symbol.exported,
    }))).toEqual([
      {
        name: "toolkit",
        qualifiedName: "toolkit",
        kind: "constant",
        exported: true,
      },
      {
        name: "Service",
        qualifiedName: "Service",
        kind: "class",
        exported: false,
      },
      {
        name: "constructor",
        qualifiedName: "Service.constructor",
        kind: "method",
        exported: false,
      },
      {
        name: "status",
        qualifiedName: "Service.status",
        kind: "method",
        exported: false,
      },
      {
        name: "status",
        qualifiedName: "Service.status",
        kind: "method",
        exported: false,
      },
      {
        name: "run",
        qualifiedName: "Service.run",
        kind: "method",
        exported: false,
      },
    ]);
  });
});
