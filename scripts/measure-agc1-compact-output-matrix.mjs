import { performance } from "node:perf_hooks";
import { isDeepStrictEqual } from "node:util";

import { decodeCompactMcpEnvelope, formatMcpEnvelope } from "../src/compact-mcp.ts";
import { dispatchTool } from "../src/mcp.ts";
import { BENCHMARK_TOKENIZER, countTokens } from "../src/tokenizer.ts";
import { cleanupCompactOutputFixtures, createCompactOutputFixture } from "../tests/fixtures/compact-output/build-fixtures.ts";
import { normalizeCompactOutputEnvelope } from "../tests/fixtures/compact-output/normalize.ts";
import { createCompactOutputQueryCases } from "../tests/fixtures/compact-output/queries.ts";

const names = ["small-frontend", "product-monorepo", "text-heavy-workspace", "dead-code-workspace"];
const selected = process.argv.find((argument) => argument.startsWith("--fixture="));
const fixtures = selected ? [selected.slice(10)] : names;
if (fixtures.some((name) => !names.includes(name))) throw new Error(`Unknown fixture: ${selected}`);

function json(envelope) { const encoded = JSON.stringify(envelope, null, 2); return { tokens: countTokens(encoded), bytes: Buffer.byteLength(encoded) }; }
function agc1(toolName, envelope) {
  if (!envelope.ok) return { tokens: null, bytes: null, reason: "error_envelope" };
  const started = performance.now();
  const formatted = formatMcpEnvelope(toolName, "compact", envelope);
  if (formatted.metrics.selectedFormat !== "compact") return { tokens: null, bytes: null, reason: "json_fallback", encodeMs: performance.now() - started };
  try {
    const decoded = decodeCompactMcpEnvelope(JSON.parse(formatted.serialized));
    return { tokens: formatted.metrics.tokens, bytes: formatted.metrics.bytes, reason: isDeepStrictEqual(decoded, envelope) ? null : "lossless_round_trip_mismatch", encodeMs: performance.now() - started };
  } catch (error) { return { tokens: null, bytes: null, reason: `decode_error:${error instanceof Error ? error.message : String(error)}` }; }
}

const records = [];
try {
  for (const name of fixtures) {
    const fixture = await createCompactOutputFixture(name);
    if (!(await dispatchTool("index_folder", { repoRoot: fixture.repoRoot })).ok) throw new Error(`Could not index ${name}`);
    for (const query of createCompactOutputQueryCases(fixture)) {
      const envelope = normalizeCompactOutputEnvelope(query.toolName, await dispatchTool(query.toolName, query.args), fixture.repoRoot);
      records.push({ fixture: name, query: query.id, toolName: query.toolName, expectedOk: query.expectsOk, json: json(envelope), agc1: agc1(query.toolName, envelope) });
    }
  }
} finally { await cleanupCompactOutputFixtures(); }
const compact = records.filter((record) => record.agc1.reason === null);
const report = { corpus: "compact-output-fixtures-v1", tokenizer: BENCHMARK_TOKENIZER, records, agc1Integrity: { eligibleSamples: compact.length, matchingSamples: compact.filter((record) => record.agc1.reason === null).length, failures: records.filter((record) => record.agc1.reason && record.agc1.reason !== "json_fallback" && record.agc1.reason !== "error_envelope").map((record) => ({ query: record.query, reason: record.agc1.reason })) }, aggregates: { jsonTokens: records.reduce((sum, record) => sum + record.json.tokens, 0), agc1Tokens: compact.reduce((sum, record) => sum + record.agc1.tokens, 0) } };
process.stdout.write(`${JSON.stringify(process.argv.includes("--summary") ? { ...report, records: report.records.length } : report, null, 2)}\n`);
