import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("relationship evidence benchmark", () => {
  it("reports stable correctness-first metrics from at least three valid runs", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--import=tsx",
        "./bench/scripts/measure-relationship-evidence.mjs",
        "--runs",
        "3",
        "--allow-dirty",
      ],
      { cwd: packageRoot, encoding: "utf8" },
    );
    const result = JSON.parse(output) as Record<string, unknown>;

    expect(result).toMatchObject({
      schemaVersion: 1,
      fixture: "relationship-evidence-v1",
      runs: 3,
      validRuns: 3,
      tokenizer: "cl100k_base",
      relationRecallPct: 100,
      relationPrecisionPct: 100,
      falseSymbolClaims: 0,
      evidenceCoveragePct: 100,
      confidenceCoveragePct: 100,
      stableOrder: true,
      engineDirty: true,
    });
    expect(result.totalResponseTokens).toEqual(expect.any(Number));
    expect(result.retrievalLatencyMs).toEqual(expect.any(Number));
  });
});
