import { performance } from "node:perf_hooks";

import {
  measureCompactCandidate,
  measureFrozenAgc1Reference,
  prefixLegendAgc2Codec,
  genericRowsAgc2Codec,
  schemaRowsAgc2Codec,
  typedRowsAgc2Codec,
} from "../src/compact-mcp-candidates.ts";
import { decodePackedRowsAgc2, encodePackedRowsAgc2 } from "../src/compact-mcp.ts";
import { dispatchTool } from "../src/mcp.ts";
import { BENCHMARK_TOKENIZER, countTokens } from "../src/tokenizer.ts";
import {
  cleanupCompactOutputFixtures,
  createCompactOutputFixture,
} from "../tests/fixtures/compact-output/build-fixtures.ts";
import { normalizeCompactOutputEnvelope } from "../tests/fixtures/compact-output/normalize.ts";
import { createCompactOutputQueryCases } from "../tests/fixtures/compact-output/queries.ts";

const allFixtureNames = ["small-frontend", "product-monorepo", "text-heavy-workspace", "dead-code-workspace"];
const fixtureArgument = process.argv.find((argument) => argument.startsWith("--fixture="));
const fixtureNames = fixtureArgument
  ? [fixtureArgument.slice("--fixture=".length)]
  : allFixtureNames;
if (fixtureNames.some((fixtureName) => !allFixtureNames.includes(fixtureName))) {
  throw new Error(`Unknown fixture: ${fixtureArgument}`);
}
const packedRowsCodec = {
  id: "agc2-packed-rows-baseline",
  encode: encodePackedRowsAgc2,
  decode: decodePackedRowsAgc2,
};

function measureJson(envelope) {
  const encodeStartedAt = performance.now();
  const encoded = JSON.stringify(envelope, null, 2);
  const encodeMs = performance.now() - encodeStartedAt;
  const decodeStartedAt = performance.now();
  const decoded = JSON.parse(encoded);
  return {
    encoded,
    decoded,
    bytes: Buffer.byteLength(encoded),
    tokens: countTokens(encoded),
    encodeMs,
    decodeMs: performance.now() - decodeStartedAt,
    tokenizer: BENCHMARK_TOKENIZER,
  };
}

function summarize(records, key) {
  const measured = records.filter((record) => record[key].tokens !== null);
  return {
    samples: records.length,
    measuredSamples: measured.length,
    totalTokens: measured.reduce((sum, record) => sum + record[key].tokens, 0),
    totalBytes: measured.reduce((sum, record) => sum + record[key].bytes, 0),
    worstTokens: measured.reduce((worst, record) => Math.max(worst, record[key].tokens), 0),
  };
}

function compareAgainstAgc1(records, key) {
  const overlapping = records.filter((record) => (
    record.agc1.tokens !== null && record[key].tokens !== null
  ));
  const agc1Tokens = overlapping.reduce((sum, record) => sum + record.agc1.tokens, 0);
  const candidateTokens = overlapping.reduce((sum, record) => sum + record[key].tokens, 0);
  const regressions = overlapping.filter((record) => record[key].tokens >= record.agc1.tokens);
  return {
    comparedSamples: overlapping.length,
    agc1Tokens,
    candidateTokens,
    savedTokens: agc1Tokens - candidateTokens,
    savedPercent: agc1Tokens === 0 ? 0 : Number((((agc1Tokens - candidateTokens) / agc1Tokens) * 100).toFixed(2)),
    nonWinningCaptures: regressions.map((record) => record.query),
  };
}

const records = [];
try {
  for (const fixtureName of fixtureNames) {
    const fixture = await createCompactOutputFixture(fixtureName);
    const indexed = await dispatchTool("index_folder", { repoRoot: fixture.repoRoot });
    if (!indexed.ok) throw new Error(`Could not index ${fixtureName}`);
    for (const queryCase of createCompactOutputQueryCases(fixture)) {
      const envelope = normalizeCompactOutputEnvelope(
        queryCase.toolName,
        await dispatchTool(queryCase.toolName, queryCase.args),
        fixture.repoRoot,
      );
      const json = measureJson(envelope);
      const agc1 = measureFrozenAgc1Reference(queryCase.toolName, envelope);
      const packedRows = measureCompactCandidate(packedRowsCodec, queryCase.toolName, envelope);
      const schemaRows = measureCompactCandidate(schemaRowsAgc2Codec, queryCase.toolName, envelope);
      const prefixLegend = measureCompactCandidate(prefixLegendAgc2Codec, queryCase.toolName, envelope);
      const typedRows = measureCompactCandidate(typedRowsAgc2Codec, queryCase.toolName, envelope);
      const genericRows = measureCompactCandidate(genericRowsAgc2Codec, queryCase.toolName, envelope);
      records.push({
        fixture: fixtureName,
        query: queryCase.id,
        category: queryCase.category,
        toolName: queryCase.toolName,
        expectedOk: queryCase.expectsOk,
        json,
        agc1,
        agc2PackedRows: packedRows,
        agc2SchemaRows: schemaRows,
        agc2PrefixLegend: prefixLegend,
        agc2TypedRows: typedRows,
        agc2GenericRows: genericRows,
        selectedOutcome: "research_only_no_serving_selection",
      });
    }
  }
} finally {
  await cleanupCompactOutputFixtures();
}

const report = {
  corpus: "compact-output-fixtures-v1",
  tokenizer: BENCHMARK_TOKENIZER,
  records,
  aggregates: {
    json: summarize(records, "json"),
    agc1: summarize(records, "agc1"),
    agc2PackedRows: summarize(records, "agc2PackedRows"),
    agc2SchemaRows: summarize(records, "agc2SchemaRows"),
    agc2PrefixLegend: summarize(records, "agc2PrefixLegend"),
    agc2TypedRows: summarize(records, "agc2TypedRows"),
    agc2GenericRows: summarize(records, "agc2GenericRows"),
    agc2PackedRowsVsAgc1: compareAgainstAgc1(records, "agc2PackedRows"),
    agc2SchemaRowsVsAgc1: compareAgainstAgc1(records, "agc2SchemaRows"),
    agc2PrefixLegendVsAgc1: compareAgainstAgc1(records, "agc2PrefixLegend"),
    agc2TypedRowsVsAgc1: compareAgainstAgc1(records, "agc2TypedRows"),
    agc2GenericRowsVsAgc1: compareAgainstAgc1(records, "agc2GenericRows"),
  },
  selection: "No production codec is selected by the Story 3 harness.",
};

if (process.argv.includes("--summary")) {
  process.stdout.write(`${JSON.stringify({
    corpus: report.corpus,
    tokenizer: report.tokenizer,
    records: report.records.length,
    aggregates: report.aggregates,
    selection: report.selection,
  }, null, 2)}\n`);
} else {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
