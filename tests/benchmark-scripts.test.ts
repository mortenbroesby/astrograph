import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const scripts: Record<string, string> = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).scripts;

describe("benchmark scripts", () => {
  it("builds before every supported benchmark command", () => {
    const benchmarkScripts = Object.keys(scripts).filter((name) => name.startsWith("bench:"));

    expect(benchmarkScripts).not.toHaveLength(0);
    for (const scriptName of benchmarkScripts) {
      expect(scripts[`pre${scriptName}`]).toBe("pnpm build");
    }
  });
});
