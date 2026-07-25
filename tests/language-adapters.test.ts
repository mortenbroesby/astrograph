import { describe, expect, it } from "vitest";

import { getSupportedLanguages } from "../src/language-registry.ts";
import { LANGUAGE_ADAPTERS } from "../src/parser/language-adapters.ts";

describe("Tree-sitter language adapters", () => {
  it("declares one explicit grammar and traversal policy per supported language", () => {
    expect(Object.keys(LANGUAGE_ADAPTERS).sort()).toEqual(getSupportedLanguages().sort());

    for (const language of getSupportedLanguages()) {
      const adapter = LANGUAGE_ADAPTERS[language];
      expect(adapter.grammar).toBeDefined();
      expect(["javascript", "structured"]).toContain(adapter.traversal);
    }
  });

  it("keeps the established JavaScript family on graph-capable traversal", () => {
    for (const language of ["ts", "tsx", "js", "jsx"] as const) {
      expect(LANGUAGE_ADAPTERS[language].traversal).toBe("javascript");
    }

    for (const language of getSupportedLanguages().filter(
      (language) => !["ts", "tsx", "js", "jsx"].includes(language),
    )) {
      expect(LANGUAGE_ADAPTERS[language].traversal).toBe("structured");
    }
  });
});
