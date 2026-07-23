import { describe, expect, it } from "vitest";

import { parseSourceFile } from "../src/parser.ts";
import { parseWithTreeSitter } from "../src/parser/tree-sitter.ts";

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
    expect(parsed.fallbackReason).toBeNull();
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

  it("extracts deterministic structured symbols for polyglot language batches", () => {
    const fixtures = [
      {
        language: "python",
        relativePath: "services/greeting.py",
        content: "class Greeter:\n  def hello(self):\n    return 1\n",
        symbols: ["Greeter", "Greeter.hello"],
      },
      {
        language: "bash",
        relativePath: "scripts/greet.sh",
        content: "greet() { echo hi; }\n",
        symbols: ["greet"],
      },
      {
        language: "powershell",
        relativePath: "scripts/Greet.ps1",
        content: "class Greeter { [void] Hello() {} }\nfunction Start-Greeting { Write-Host hi }\n",
        symbols: ["Greeter", "Greeter.Hello", "Start-Greeting"],
      },
      {
        language: "csharp",
        relativePath: "services/Greeter.cs",
        content: "public class Greeter { public void Hello() {} }\n",
        symbols: ["Greeter", "Greeter.Hello"],
      },
      {
        language: "java",
        relativePath: "services/Greeter.java",
        content: "class Greeter { void hello() {} }\n",
        symbols: ["Greeter", "Greeter.hello"],
      },
      {
        language: "go",
        relativePath: "services/greet.go",
        content: "package greeting\nfunc Start() {}\n",
        symbols: ["Start"],
      },
      {
        language: "rust",
        relativePath: "services/greet.rs",
        content: "struct Greeter {}\nfn start() {}\n",
        symbols: ["Greeter", "start"],
      },
      {
        language: "json",
        relativePath: "package.json",
        content: "{\"name\": \"astrograph\", \"scripts\": {\"test\": \"vitest\"}}\n",
        symbols: ["name", "scripts"],
      },
      {
        language: "html",
        relativePath: "web/index.html",
        content: "<main><h1>Hello</h1></main>\n",
        symbols: ["main"],
      },
      {
        language: "css",
        relativePath: "web/app.css",
        content: ".card { color: red; }\n",
        symbols: ["card"],
      },
      {
        language: "c",
        relativePath: "native/greet.c",
        content: "struct Greeter {}; void hello(void) {}\n",
        symbols: ["Greeter", "hello"],
      },
      {
        language: "cpp",
        relativePath: "native/greet.cpp",
        content: "class Greeter { void hello() {} }; void start() {}\n",
        symbols: ["Greeter", "Greeter.hello", "start"],
      },
      {
        language: "php",
        relativePath: "services/Greeter.php",
        content: "<?php class Greeter { function hello() {} }\n",
        symbols: ["Greeter", "Greeter.hello"],
      },
      {
        language: "ruby",
        relativePath: "services/greet.rb",
        content: "class Greeter\n  def hello; end\nend\n",
        symbols: ["Greeter", "Greeter.hello"],
      },
      {
        language: "template",
        relativePath: "web/greet.erb",
        content: "<h1><%= title %></h1>\n",
        symbols: [],
      },
      {
        language: "scala",
        relativePath: "services/Greeter.scala",
        content: "class Greeter { def hello(): Unit = {} }\n",
        symbols: ["Greeter", "Greeter.hello"],
      },
      {
        language: "ocaml",
        relativePath: "services/greet.ml",
        content: "let hello () = 1\n",
        symbols: ["hello"],
      },
      {
        language: "haskell",
        relativePath: "services/Greet.hs",
        content: "hello = 1\n",
        symbols: ["hello"],
      },
      {
        language: "julia",
        relativePath: "services/greet.jl",
        content: "function hello()\nend\n",
        symbols: ["hello"],
      },
    ] as const;

    for (const fixture of fixtures) {
      const first = parseSourceFile(fixture);
      const second = parseSourceFile(fixture);

      expect(first.fallbackUsed).toBe(false);
      expect(first.imports).toEqual([]);
      expect(first.symbols.map((symbol) => symbol.qualifiedName)).toEqual(fixture.symbols);
      expect(first.symbols.map((symbol) => symbol.id)).toEqual(
        second.symbols.map((symbol) => symbol.id),
      );
    }
  });

  it("keeps structured parsing bounded and deterministic for Unicode, CRLF, and syntax errors", () => {
    const unicode = parseSourceFile({
      relativePath: "services/hej.py",
      language: "python",
      content: "def héj():\r\n  return 1\r\n",
    });
    const malformed = parseSourceFile({
      relativePath: "config/broken.json",
      language: "json",
      content: '{"näme": }\n',
    });

    expect(unicode.fallbackUsed).toBe(false);
    expect(unicode.symbols).toEqual([
      expect.objectContaining({
        name: "héj",
        qualifiedName: "héj",
        startLine: 1,
        endLine: 2,
      }),
    ]);
    expect(malformed.fallbackUsed).toBe(false);
    expect(malformed.symbols.map((symbol) => symbol.name)).toEqual(["näme"]);
  });

  it("does not report chunk recovery when the parser handles a large file directly", () => {
    const content = Array.from({ length: 900 }, (_, index) =>
      `export function helper${index}(value: number): number { return value + ${index}; }`,
    ).join("\n");

    const parsed = parseWithTreeSitter({
      relativePath: "src/large.ts",
      language: "ts",
      content: `${content}\n`,
    });

    expect(parsed.backend).toBe("tree-sitter");
    expect(parsed.fallbackUsed).toBe(false);
    expect(parsed.fallbackReason).toBeNull();
    expect(parsed.symbols).toHaveLength(900);
    expect(parsed.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "helper0",
          exported: true,
          kind: "function",
        }),
        expect.objectContaining({
          name: "helper899",
          exported: true,
          kind: "function",
        }),
      ]),
    );
  });
});
