import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { decodeCompactMcpEnvelope, formatMcpEnvelope } from "../src/compact-mcp.ts";
import { dispatchTool } from "../src/mcp.ts";
import { BENCHMARK_TOKENIZER, countTokens } from "../src/tokenizer.ts";
import { cleanupCompactOutputFixtures, createCompactOutputFixture } from "../tests/fixtures/compact-output/build-fixtures.ts";
import { normalizeCompactOutputEnvelope } from "../tests/fixtures/compact-output/normalize.ts";
import { createCompactOutputQueryCases } from "../tests/fixtures/compact-output/queries.ts";
import { createCompactOutputTraceCases } from "../tests/fixtures/compact-output/traces.ts";

const names = ["small-frontend", "product-monorepo", "text-heavy-workspace", "dead-code-workspace"];
const selected = process.argv.find((argument) => argument.startsWith("--fixture="));
const fixtures = selected ? [selected.slice(10)] : names;
if (fixtures.some((name) => !names.includes(name))) throw new Error(`Unknown fixture: ${selected}`);

function json(envelope) {
  const encoded = JSON.stringify(envelope, null, 2);
  return {
    tokens: countTokens(encoded),
    bytes: Buffer.byteLength(encoded),
    responseHash: createHash("sha256").update(encoded).digest("hex"),
  };
}
function agc1(toolName, envelope) {
  if (!envelope.ok) return { tokens: null, bytes: null, reason: "error_envelope" };
  const started = performance.now();
  const formatted = formatMcpEnvelope(toolName, "compact", envelope);
  if (formatted.metrics.selectedFormat !== "compact") return { tokens: null, bytes: null, reason: "json_fallback", encodeMs: performance.now() - started };
  try {
    const decoded = decodeCompactMcpEnvelope(JSON.parse(formatted.serialized));
    const recovery = isDeepStrictEqual(decoded, envelope) ? "exact" : "mismatch";
    return { tokens: formatted.metrics.tokens, bytes: formatted.metrics.bytes, recovery, reason: recovery === "exact" ? null : "lossless_round_trip_mismatch", encodeMs: performance.now() - started };
  } catch (error) { return { tokens: null, bytes: null, recovery: "unavailable", reason: `decode_error:${error instanceof Error ? error.message : String(error)}` }; }
}

const records = [];
try {
  for (const name of fixtures) {
    const fixture = await createCompactOutputFixture(name);
    if (!(await dispatchTool("index_folder", { repoRoot: fixture.repoRoot })).ok) throw new Error(`Could not index ${name}`);
    const queries = createCompactOutputQueryCases(fixture);
    const queryById = new Map(queries.map((query) => [query.id, query]));
    for (const trace of createCompactOutputTraceCases(fixture, queries)) {
      for (const [step, queryId] of trace.queryIds.entries()) {
        const query = queryById.get(queryId);
        if (!query) throw new Error(`Unknown compact-output trace query: ${queryId}`);
        const started = performance.now();
        const envelope = normalizeCompactOutputEnvelope(query.toolName, await dispatchTool(query.toolName, query.args), fixture.repoRoot);
        records.push({ fixture: name, trace: trace.id, operationClass: trace.operationClass, step: step + 1, query: query.id, toolName: query.toolName, expectedOk: query.expectsOk, elapsedMs: performance.now() - started, json: json(envelope), agc1: agc1(query.toolName, envelope) });
      }
    }
  }
} finally { await cleanupCompactOutputFixtures(); }
const compact = records.filter((record) => record.agc1.reason === null);
const traces = Object.values(Object.groupBy(records, (record) => record.trace)).map((traceRecords) => ({
  fixture: traceRecords[0].fixture,
  trace: traceRecords[0].trace,
  operationClass: traceRecords[0].operationClass,
  captures: traceRecords.length,
  jsonTokens: traceRecords.reduce((sum, record) => sum + record.json.tokens, 0),
  agc1Tokens: traceRecords.filter((record) => record.agc1.reason === null).reduce((sum, record) => sum + record.agc1.tokens, 0),
}));
const report = { schemaVersion: 2, corpus: "compact-output-repeat-read-traces-v1", tokenizer: BENCHMARK_TOKENIZER, records, traces, agc1Integrity: { eligibleSamples: compact.length, matchingSamples: compact.filter((record) => record.agc1.reason === null).length, failures: records.filter((record) => record.agc1.reason && record.agc1.reason !== "json_fallback" && record.agc1.reason !== "error_envelope").map((record) => ({ trace: record.trace, step: record.step, query: record.query, reason: record.agc1.reason })) }, aggregates: { jsonTokens: records.reduce((sum, record) => sum + record.json.tokens, 0), agc1Tokens: compact.reduce((sum, record) => sum + record.agc1.tokens, 0) } };
const { records: reportRecords, ...summary } = report;
summary.records = reportRecords.length;
process.stdout.write(`${JSON.stringify(process.argv.includes("--summary") ? summary : report, null, 2)}\n`);
