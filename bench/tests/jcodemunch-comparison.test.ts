import { describe, expect, it } from "vitest";

// @ts-expect-error This test is the typed contract for the JavaScript benchmark runner.
import { assertSuccessfulIndexResult, assertSuccessfulSourceResult, findAstrographSymbolIds, findJCodeMunchSymbolIds, parseComparisonOptions, renderComparisonReport, summarizeComparisonRuns } from "../scripts/jcodemunch-comparison.mjs";

const targets = ["loadBenchmarkCorpus", "loadBenchmarkTaskCard"];

describe("jCodeMunch comparison benchmark", () => {
  it("accepts the package-manager separator", () => {
    expect(parseComparisonOptions(["--", "--runs", "2"])).toMatchObject({ runs: 2 });
  });

  it("reads Astrograph symbol ids from the MCP response envelope", () => {
    expect(findAstrographSymbolIds(JSON.stringify({
      ok: true,
      data: { items: [
        { id: "symbol-1", name: targets[0] },
        { id: "symbol-2", name: targets[1] },
      ] },
    }), targets)).toEqual(["symbol-1", "symbol-2"]);
  });

  it("expands jCodeMunch compact aliases for both target symbols", () => {
    const search = [
      "#MUNCH/1 tool=search_symbols enc=ss1",
      "@1=bench/src/corpus.ts",
      "",
      "s,@1::loadBenchmarkCorpus#function,loadBenchmarkCorpus,function,@1,8,1",
      "s,@1::loadBenchmarkTaskCard#function,loadBenchmarkTaskCard,function,@1,24,0.9",
    ].join("\n");

    expect(findJCodeMunchSymbolIds(search, targets)).toEqual([
      "bench/src/corpus.ts::loadBenchmarkCorpus#function",
      "bench/src/corpus.ts::loadBenchmarkTaskCard#function",
    ]);
  });

  it("rejects tool errors and missing source bodies", () => {
    expect(() => assertSuccessfulSourceResult(
      "jcodemunch",
      JSON.stringify({ error: "Symbol not found", symbols: [], errors: [] }),
      targets,
    )).toThrow("Symbol not found");
    expect(() => assertSuccessfulSourceResult(
      "jcodemunch",
      JSON.stringify({
        symbols: [{ name: targets[0], source: `export function ${targets[0]}() {}` }],
        errors: [],
      }),
      targets,
    )).toThrow(targets[1]);
  });

  it("accepts successful two-symbol source batches from either server", () => {
    expect(assertSuccessfulSourceResult(
      "jcodemunch",
      JSON.stringify({
        symbols: targets.map((name) => ({ name, source: `export function ${name}() {}` })),
        errors: [],
      }),
      targets,
    )).toBe(true);
    expect(assertSuccessfulSourceResult(
      "astrograph",
      JSON.stringify({
        ok: true,
        data: {
          items: targets.map((name) => ({
            symbol: { name },
            source: `export function ${name}() {}`,
          })),
        },
      }),
      targets,
    )).toBe(true);
  });

  it("rejects a fast jCodeMunch index error instead of measuring it as warm", () => {
    expect(() => assertSuccessfulIndexResult("jcodemunch", {
      success: false,
      error: "identity collision",
    })).toThrow("identity collision");
  });

  it("summarizes matched runs without mixing schema and retrieval tokens", () => {
    const summaries = summarizeComparisonRuns([
      {
        server: "astrograph",
        schemaTokens: 100,
        baselineTokens: 1000,
        retrievalTokens: 200,
        sourceTokens: 120,
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
        sourceTokens: 180,
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
        sourceTokens: 40,
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
        medianSourceTokens: 150,
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
        medianRetrievalTokens: null,
        medianSourceTokens: null,
        medianTokenReductionPct: null,
        medianColdIndexMs: null,
        medianWarmIndexMs: null,
        medianRetrievalMs: null,
        medianToolCalls: null,
      },
    ]);

    const report = renderComparisonReport({
      repoSha: "abc123",
      tokenizer: "cl100k_base",
      taskId: "task-corpus-loader",
      summaries,
    });
    expect(report).toContain("| astrograph | 2 | 2 | 100 | 250 | 150 | 75% |");
    expect(report).toContain("Schema tokens are reported separately");
  });
});
