import { performance } from "node:perf_hooks";
import { isDeepStrictEqual } from "node:util";

import {
  measureCompactCandidate,
  measureFrozenAgc1Reference,
  aliasSymbolsAgc2Codec,
  directoryTreeAgc2Codec,
  prefixLegendAgc2Codec,
  genericRowsAgc2Codec,
  schemaRowsAgc2Codec,
  typedRowsAgc2Codec,
} from "../src/compact-mcp-candidates.ts";
import {
  decodeCompactMcpEnvelope,
  decodePackedRowsAgc2,
  encodePackedRowsAgc2,
  formatMcpEnvelope,
} from "../src/compact-mcp.ts";
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

function rejectedServingAgc1(reason, encodeMs = 0) {
  return {
    candidateId: "agc1-serving",
    encoded: null,
    decoded: null,
    bytes: null,
    tokens: null,
    encodeMs,
    decodeMs: null,
    tokenizer: BENCHMARK_TOKENIZER,
    rejectionReason: reason,
  };
}

function measureServingAgc1(toolName, envelope) {
  if (!envelope.ok) return rejectedServingAgc1("error_envelope");
  const startedAt = performance.now();
  const formatted = formatMcpEnvelope(toolName, "compact", envelope);
  const encodeMs = performance.now() - startedAt;
  if (formatted.metrics.selectedFormat !== "compact") {
    return rejectedServingAgc1("json_fallback", encodeMs);
  }

  let decoded;
  let decodeMs;
  try {
    const decodeStartedAt = performance.now();
    decoded = decodeCompactMcpEnvelope(JSON.parse(formatted.serialized));
    decodeMs = performance.now() - decodeStartedAt;
  } catch (error) {
    return rejectedServingAgc1(`decode_error:${error instanceof Error ? error.message : String(error)}`, encodeMs);
  }
  if (!isDeepStrictEqual(decoded, envelope)) {
    return {
      ...rejectedServingAgc1("lossless_round_trip_mismatch", encodeMs),
      encoded: formatted.serialized,
      decoded,
      bytes: Buffer.byteLength(formatted.serialized),
      tokens: countTokens(formatted.serialized),
      decodeMs,
    };
  }
  const frozen = measureFrozenAgc1Reference(toolName, envelope);
  if (frozen.encoded !== formatted.serialized) {
    return {
      ...rejectedServingAgc1("frozen_reference_mismatch", encodeMs),
      encoded: formatted.serialized,
      decoded,
      bytes: Buffer.byteLength(formatted.serialized),
      tokens: countTokens(formatted.serialized),
      decodeMs,
    };
  }
  return {
    candidateId: "agc1-serving",
    encoded: formatted.serialized,
    decoded,
    bytes: Buffer.byteLength(formatted.serialized),
    tokens: countTokens(formatted.serialized),
    encodeMs,
    decodeMs,
    tokenizer: BENCHMARK_TOKENIZER,
    rejectionReason: null,
  };
}

function compareMeasurements(records, baselineKey, candidateKey) {
  const overlapping = records.filter((record) => (
    (record[baselineKey].rejectionReason === null
      || (baselineKey === "agc1" && record[baselineKey].rejectionReason === "reference_encoder_only"))
    && record[candidateKey].rejectionReason === null
    && record[baselineKey].tokens !== null
    && record[candidateKey].tokens !== null
  ));
  const baselineTokens = overlapping.reduce((sum, record) => sum + record[baselineKey].tokens, 0);
  const candidateTokens = overlapping.reduce((sum, record) => sum + record[candidateKey].tokens, 0);
  const regressions = overlapping.filter((record) => record[candidateKey].tokens >= record[baselineKey].tokens);
  return {
    comparedSamples: overlapping.length,
    baseline: baselineKey,
    baselineTokens,
    candidateTokens,
    savedTokens: baselineTokens - candidateTokens,
    savedPercent: baselineTokens === 0 ? 0 : Number((((baselineTokens - candidateTokens) / baselineTokens) * 100).toFixed(2)),
    nonWinningCaptures: regressions.map((record) => record.query),
  };
}

function summarizeServingAgc1Integrity(records) {
  const eligible = records.filter((record) => record.agc1.tokens !== null);
  const failures = eligible.filter((record) => record.agc1Serving.rejectionReason !== null);
  return {
    eligibleSamples: eligible.length,
    matchingSamples: eligible.length - failures.length,
    failures: failures.map((record) => ({
      query: record.query,
      reason: record.agc1Serving.rejectionReason,
    })),
    exactTokenMatch: failures.length === 0,
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
      const agc1Serving = measureServingAgc1(queryCase.toolName, envelope);
      const packedRows = measureCompactCandidate(packedRowsCodec, queryCase.toolName, envelope);
      const schemaRows = measureCompactCandidate(schemaRowsAgc2Codec, queryCase.toolName, envelope);
      const prefixLegend = measureCompactCandidate(prefixLegendAgc2Codec, queryCase.toolName, envelope);
      const typedRows = measureCompactCandidate(typedRowsAgc2Codec, queryCase.toolName, envelope);
      const genericRows = measureCompactCandidate(genericRowsAgc2Codec, queryCase.toolName, envelope);
      const aliasSymbols = measureCompactCandidate(aliasSymbolsAgc2Codec, queryCase.toolName, envelope);
      const directoryTree = measureCompactCandidate(directoryTreeAgc2Codec, queryCase.toolName, envelope);
      records.push({
        fixture: fixtureName,
        query: queryCase.id,
        category: queryCase.category,
        toolName: queryCase.toolName,
        expectedOk: queryCase.expectsOk,
        json,
        agc1,
        agc1Serving,
        agc2PackedRows: packedRows,
        agc2SchemaRows: schemaRows,
        agc2PrefixLegend: prefixLegend,
        agc2TypedRows: typedRows,
        agc2GenericRows: genericRows,
        agc2AliasSymbols: aliasSymbols,
        agc2DirectoryTree: directoryTree,
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
    agc1Serving: summarize(records, "agc1Serving"),
    agc2PackedRows: summarize(records, "agc2PackedRows"),
    agc2SchemaRows: summarize(records, "agc2SchemaRows"),
    agc2PrefixLegend: summarize(records, "agc2PrefixLegend"),
    agc2TypedRows: summarize(records, "agc2TypedRows"),
    agc2GenericRows: summarize(records, "agc2GenericRows"),
    agc2AliasSymbols: summarize(records, "agc2AliasSymbols"),
    agc2DirectoryTree: summarize(records, "agc2DirectoryTree"),
    agc1ServingBaselineIntegrity: summarizeServingAgc1Integrity(records),
    agc2PackedRowsVsAgc1: compareMeasurements(records, "agc1Serving", "agc2PackedRows"),
    agc2SchemaRowsVsAgc1: compareMeasurements(records, "agc1Serving", "agc2SchemaRows"),
    agc2PrefixLegendVsAgc1: compareMeasurements(records, "agc1Serving", "agc2PrefixLegend"),
    agc2TypedRowsVsAgc1: compareMeasurements(records, "agc1Serving", "agc2TypedRows"),
    agc2GenericRowsVsAgc1: compareMeasurements(records, "agc1Serving", "agc2GenericRows"),
    agc2AliasSymbolsVsAgc1: compareMeasurements(records, "agc1Serving", "agc2AliasSymbols"),
    agc2DirectoryTreeVsAgc1: compareMeasurements(records, "agc1Serving", "agc2DirectoryTree"),
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
