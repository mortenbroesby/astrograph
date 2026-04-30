import { describe, expect, it } from "vitest";

import { createPathMatcher } from "../src/path-matcher.ts";

describe("path matcher", () => {
  it("matches a single include glob", () => {
    const matcher = createPathMatcher({ include: ["src/*.ts"] });

    expect(matcher.matches("src/index.ts")).toBe(true);
    expect(matcher.matches("src/nested/index.ts")).toBe(false);
  });

  it("supports multiple include globs", () => {
    const matcher = createPathMatcher({
      include: ["src/**/*.ts", "tests/**/*.ts"],
    });

    expect(matcher.matches("src/nested/index.ts")).toBe(true);
    expect(matcher.matches("tests/unit/index.ts")).toBe(true);
    expect(matcher.matches("docs/index.ts")).toBe(false);
  });

  it("gives exclude globs precedence over include globs", () => {
    const matcher = createPathMatcher({
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
    });

    expect(matcher.matches("src/index.ts")).toBe(true);
    expect(matcher.matches("src/index.test.ts")).toBe(false);
  });

  it("normalizes windows-style path separators", () => {
    const matcher = createPathMatcher({ include: ["src\\**\\*.ts"] });

    expect(matcher.matches("src\\nested\\index.ts")).toBe(true);
    expect(matcher.matches("src/nested/index.ts")).toBe(true);
  });

  it("matches dotfiles when the glob allows them", () => {
    const matcher = createPathMatcher({ include: ["src/*.ts"] });

    expect(matcher.matches("src/.hidden.ts")).toBe(true);
  });
});
