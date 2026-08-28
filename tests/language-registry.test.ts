import { describe, expect, it } from "vitest";

import {
  createLanguageByExtension,
  LANGUAGE_SUPPORT_REGISTRY,
  supportedLanguageForFile,
} from "../src/language-registry.ts";

describe("language registry", () => {
  it("uses deterministic extension ownership for the public registry", () => {
    expect(supportedLanguageForFile("component.TSX")).toBe("tsx");
    expect(supportedLanguageForFile("native/header.h")).toBe("c");
    expect(supportedLanguageForFile("native/header.hpp")).toBe("cpp");
    expect(LANGUAGE_SUPPORT_REGISTRY).toEqual(expect.arrayContaining([
      expect.objectContaining({ language: "ts", grammar: "typescript", traversal: "javascript" }),
      expect.objectContaining({ language: "csharp", grammar: "c_sharp", traversal: "structured" }),
      expect.objectContaining({ language: "template", grammar: "embedded_template", traversal: "structured" }),
    ]));
  });

  it("rejects ambiguous extension ownership", () => {
    const [first] = LANGUAGE_SUPPORT_REGISTRY;
    expect(first).toBeDefined();
    expect(() => createLanguageByExtension([
      first!,
      { ...first!, language: "js", extensions: [".ts"] },
    ])).toThrow(/Ambiguous language extension \.ts: ts and js/);
  });
});
