import { access, readFile } from "node:fs/promises";

import { getWasmPath } from "tree-sitter-wasm";
import { describe, expect, it } from "vitest";

import { LANGUAGE_ADAPTERS } from "../src/parser/language-adapters.ts";

describe("WASM parser assets", () => {
  it("ships a pinned, MIT-licensed asset for every supported adapter", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../node_modules/tree-sitter-wasm/package.json", import.meta.url), "utf8"),
    ) as { license?: string };

    expect(packageJson.license).toBe("MIT");
    expect(Object.keys(LANGUAGE_ADAPTERS)).toHaveLength(20);

    await Promise.all(
      Object.values(LANGUAGE_ADAPTERS).map(({ grammar }) => access(getWasmPath(grammar))),
    );
  });
});
