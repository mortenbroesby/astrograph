import { describe, expect, it } from "vitest";

// @ts-expect-error This test is the typed contract for the JavaScript benchmark runner.
import { runCompactOutputTraceBenchmark } from "../bench/scripts/measure-agc1-compact-output-matrix.mjs";
import { getCommandByMcpToolName } from "../src/command-registry.ts";
import * as engine from "../src/index.ts";
import { setMcpCommandExecutorForTest } from "../src/mcp.ts";
import { createCompactOutputTraceCases } from "./fixtures/compact-output/traces.ts";
import { createCompactOutputQueryCases } from "./fixtures/compact-output/queries.ts";

const fixture = {
  name: "small-frontend" as const,
  repoRoot: "/fixture",
  outlinePath: "src/Button.tsx",
  symbolQuery: "Button",
  textQuery: "Save",
};
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
    const reset = setMcpCommandExecutorForTest(async (name, args) => {
      const command = getCommandByMcpToolName(name);
      if (!command) {
        throw new Error(`Unsupported test command: ${name}`);
      }
      return command.execute(engine, args as never);
    });
    let report: {
      schemaVersion: number;
      records: number;
      traces: Array<{ operationClass: string; captures: number; referenceCaptures: number; referenceSavingsTokens: number }>;
      agc1Integrity: { matchingSamples: number };
    };
    try {
      ({ summary: report } = await runCompactOutputTraceBenchmark({
        fixtures: ["small-frontend"],
      }));
    } finally {
      reset();
    }

    expect(report).toMatchObject({ schemaVersion: 3, records: 8, agc1Integrity: { matchingSamples: 4 } });
    expect(report.traces).toEqual([
      expect.objectContaining({ operationClass: "one-shot-exploration", captures: 4, referenceCaptures: 0, referenceSavingsTokens: 0 }),
      expect.objectContaining({ operationClass: "repeat-read", captures: 4, referenceCaptures: 2, referenceSavingsTokens: expect.any(Number) }),
    ]);
    expect(report.traces[1].referenceSavingsTokens).toBeGreaterThan(0);
    expect(JSON.stringify(report)).not.toContain("Button");
    expect(JSON.stringify(report)).not.toContain("/fixture");
  }, 30_000);
});
