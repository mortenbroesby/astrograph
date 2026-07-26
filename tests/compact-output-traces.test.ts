import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createCompactOutputTraceCases } from "./fixtures/compact-output/traces.ts";
import { createCompactOutputQueryCases } from "./fixtures/compact-output/queries.ts";

const fixture = {
  name: "small-frontend" as const,
  repoRoot: "/fixture",
  outlinePath: "src/Button.tsx",
  symbolQuery: "Button",
  textQuery: "Save",
};
const execFile = promisify(execFileCallback);

describe("compact-output repeat-read traces", () => {
  it("keeps checked-in one-shot and repeat-read sequences deterministic", () => {
    const traces = createCompactOutputTraceCases(fixture, createCompactOutputQueryCases(fixture));
    expect(traces).toEqual([
      {
        id: "small-frontend:one-shot-exploration",
        operationClass: "one-shot-exploration",
        queryIds: ["small-frontend:find-files", "small-frontend:search-symbols", "small-frontend:file-outline", "small-frontend:task-context"],
      },
      {
        id: "small-frontend:repeat-symbol-context",
        operationClass: "repeat-read",
        queryIds: ["small-frontend:search-symbols", "small-frontend:task-context", "small-frontend:search-symbols", "small-frontend:task-context"],
      },
    ]);
  });

  it("prints a source-free, versioned trace report", async () => {
    const { stdout } = await execFile(process.execPath, [
      "--experimental-strip-types",
      "./scripts/measure-agc1-compact-output-matrix.mjs",
      "--fixture=small-frontend",
      "--summary",
    ], { cwd: process.cwd() });
    const report = JSON.parse(stdout) as {
      schemaVersion: number;
      records: number;
      traces: Array<{ operationClass: string; captures: number }>;
      agc1Integrity: { matchingSamples: number };
    };

    expect(report).toMatchObject({ schemaVersion: 2, records: 8, agc1Integrity: { matchingSamples: 4 } });
    expect(report.traces).toEqual([
      expect.objectContaining({ operationClass: "one-shot-exploration", captures: 4 }),
      expect.objectContaining({ operationClass: "repeat-read", captures: 4 }),
    ]);
    expect(stdout).not.toContain("Button");
    expect(stdout).not.toContain("/fixture");
  }, 30_000);
});
