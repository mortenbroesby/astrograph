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

  it("keeps tree-sitter parser output deterministic across ts/js/tsx/jsx fixtures", () => {
    const fixtures = [
      {
        language: "ts",
        relativePath: "src/parser-fixture.ts",
        content: `import type { WidgetProps } from "./types";

export interface WidgetProps {
  label: string;
}

export const count = 3;

  export function makeLabel(value: string): string {
  return \`\${value}:\${count}\`;
}

class ParserService {
  handle(input: string): string {
    return input;
  }
}

export const widget = {
  props: {} as WidgetProps,
  helper: new ParserService(),
};
`,
      },
      {
        language: "js",
        relativePath: "src/parser-fixture.js",
        content: `export const answer = 42;

export function formatValue(value) {
  return String(value).trim();
}

class ParserService {
  constructor() {}
  transform(value) {
    return value;
  }
}`,
      },
      {
        language: "tsx",
        relativePath: "src/parser-fixture.tsx",
        content: `export interface WidgetProps {
  label: string;
}

export function Widget(props: WidgetProps) {
  return <div>{"label"}</div>;
}

export const render = (props: WidgetProps) => <span>{"label"}</span>;
`,
      },
      {
        language: "jsx",
        relativePath: "src/parser-fixture.jsx",
        content: `export function Widget() {
  return <section>parser coverage</section>;
}

export const render = () => <button>run</button>;
`,
      },
    ] as const;

    for (const fixture of fixtures) {
      const first = parseSourceFile({
        relativePath: fixture.relativePath,
        language: fixture.language,
        content: fixture.content,
      });
      const second = parseSourceFile({
        relativePath: fixture.relativePath,
        language: fixture.language,
        content: fixture.content,
      });

      expect(first.backend).toBe("tree-sitter");
      expect(first.fallbackUsed).toBe(false);
      expect(first.fallbackReason).toBeNull();
      expect(first.symbols.length).toBeGreaterThan(1);
      expect(first.symbols).toHaveLength(second.symbols.length);
      expect(first.symbols.map((entry) => entry.name)).toEqual(
        second.symbols.map((entry) => entry.name),
      );
      expect(first.symbols.map((entry) => entry.id)).toEqual(
        second.symbols.map((entry) => entry.id),
      );
      expect(first.symbols.map((entry) => entry.qualifiedName)).toEqual(
        second.symbols.map((entry) => entry.qualifiedName),
      );
      expect(first.symbols.map((entry) => entry.signature)).toEqual(
        second.symbols.map((entry) => entry.signature),
      );
    }
  });
});
