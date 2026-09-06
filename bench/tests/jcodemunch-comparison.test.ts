import { describe, expect, it } from "vitest";

// @ts-expect-error This test is the typed contract for the JavaScript benchmark runner.
import { firstAstrographSymbolId, parseComparisonOptions, renderComparisonReport, summarizeComparisonRuns } from "../scripts/jcodemunch-comparison.mjs";

describe("jCodeMunch comparison benchmark", () => {
  it("accepts the package-manager separator", () => {
    expect(parseComparisonOptions(["--", "--runs", "2"])).toMatchObject({ runs: 2 });
  });

  it("reads Astrograph symbol ids from the MCP response envelope", () => {
    expect(firstAstrographSymbolId(JSON.stringify({
      ok: true,
      data: { items: [{ id: "symbol-1" }] },
    }))).toBe("symbol-1");
  });

  it("summarizes matched runs without mixing schema and retrieval tokens", () => {
    const summaries = summarizeComparisonRuns([
      {
        server: "astrograph",
        schemaTokens: 100,
        baselineTokens: 1000,
        retrievalTokens: 200,
        coldIndexMs: 30,
        warmIndexMs: 10,
        retrievalMs: 5,
        toolCalls: 2,
        success: true,
      },
      {
        server: "astrograph",
        schemaTokens: 100,
        baselineTokens: 1000,
        retrievalTokens: 300,
        coldIndexMs: 50,
        warmIndexMs: 20,
        retrievalMs: 7,
        toolCalls: 2,
        success: true,
      },
      {
        server: "jcodemunch",
        schemaTokens: 80,
        baselineTokens: 1000,
        retrievalTokens: 400,
        coldIndexMs: 20,
        warmIndexMs: 8,
        retrievalMs: 4,
        toolCalls: 2,
        success: false,
      },
    ]);

    expect(summaries).toEqual([
      {
        server: "astrograph",
        runs: 2,
        successes: 2,
        schemaTokens: 100,
        baselineTokens: 1000,
        medianRetrievalTokens: 250,
        medianTokenReductionPct: 75,
        medianColdIndexMs: 40,
        medianWarmIndexMs: 15,
        medianRetrievalMs: 6,
        medianToolCalls: 2,
      },
      {
        server: "jcodemunch",
        runs: 1,
        successes: 0,
        schemaTokens: 80,
        baselineTokens: 1000,
        medianRetrievalTokens: 400,
        medianTokenReductionPct: 60,
        medianColdIndexMs: 20,
        medianWarmIndexMs: 8,
        medianRetrievalMs: 4,
        medianToolCalls: 2,
      },
    ]);

    const report = renderComparisonReport({
      repoSha: "abc123",
      tokenizer: "cl100k_base",
      taskId: "task-corpus-loader",
      summaries,
    });
    expect(report).toContain("| astrograph | 2 | 2 | 100 | 250 | 75% |");
    expect(report).toContain("Schema tokens are reported separately");
  });
});
