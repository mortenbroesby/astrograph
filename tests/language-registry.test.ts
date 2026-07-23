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
