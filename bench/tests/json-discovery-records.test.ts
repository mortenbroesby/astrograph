import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("JSON discovery records benchmark", () => {
  it("reports stable bounded discovery and exact-source fidelity", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--import=tsx",
        "./bench/scripts/measure-json-discovery-records.mjs",
        "--runs",
        "3",
        "--allow-dirty",
      ],
      { cwd: packageRoot, encoding: "utf8" },
    );
    const result = JSON.parse(output) as Record<string, unknown>;

    expect(result).toMatchObject({
      schemaVersion: 1,
      fixture: "json-discovery-records-v1",
      runs: 3,
      validRuns: 3,
      tokenizer: "cl100k_base",
      sourceFidelityPct: 100,
      stableOrder: true,
    });
    expect(typeof result.engineDirty).toBe("boolean");
    for (const metric of [
      "discoveryBytes",
      "discoveryTokens",
      "targetRank",
      "exactSourceBytes",
      "exactSourceTokens",
      "retrievalLatencyMs",
    ]) {
      expect(result[metric]).toEqual(expect.any(Number));
    }
  });
});
