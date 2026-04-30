import { describe, expect, it } from "vitest";

import { parseSourceFile } from "../src/parser.ts";

describe("astrograph parser golden coverage", () => {
  it("extracts common export, class, object, and namespace constructs on the oxc path", () => {
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

    expect(parsed.backend).toBe("oxc");
    expect(parsed.fallbackUsed).toBe(false);
    expect(parsed.imports.map((entry) => entry.source)).toContain("./dep");
    expect(parsed.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "toolkit",
          exported: true,
          kind: "constant",
        }),
        expect.objectContaining({
          name: "build",
          qualifiedName: "toolkit.build",
          kind: "method",
          exported: true,
        }),
        expect.objectContaining({
          name: "format",
          qualifiedName: "toolkit.format",
          kind: "method",
          exported: true,
        }),
        expect.objectContaining({
          name: "legacy",
          qualifiedName: "toolkit.legacy",
          kind: "method",
          exported: true,
        }),
        expect.objectContaining({
          name: "Service",
          exported: true,
          kind: "class",
        }),
        expect.objectContaining({
          name: "constructor",
          qualifiedName: "Service.constructor",
          kind: "method",
        }),
        expect.objectContaining({
          name: "status",
          qualifiedName: "Service.status",
        }),
        expect.objectContaining({
          name: "ready",
          qualifiedName: "Service.ready",
          kind: "constant",
        }),
        expect.objectContaining({
          name: "run",
          qualifiedName: "Service.run",
          kind: "method",
        }),
        expect.objectContaining({
          name: "aliasedThing",
          exported: true,
          kind: "constant",
        }),
        expect.objectContaining({
          name: "default",
          exported: true,
          kind: "function",
        }),
        expect.objectContaining({
          name: "Shapes",
          exported: true,
          kind: "type",
        }),
        expect.objectContaining({
          name: "area",
          qualifiedName: "Shapes.area",
          exported: true,
          kind: "function",
        }),
      ]),
    );
  });
});
