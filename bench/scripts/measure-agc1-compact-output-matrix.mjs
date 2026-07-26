import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { decodeCompactMcpEnvelope, formatMcpEnvelope } from "../../src/compact-mcp.ts";
import { dispatchTool } from "../../src/mcp.ts";
import { readDaemonRuntime } from "../../src/daemon-runtime.ts";
import { BENCHMARK_TOKENIZER, countTokens } from "../../src/tokenizer.ts";
import { cleanupCompactOutputFixtures, createCompactOutputFixture } from "../../tests/fixtures/compact-output/build-fixtures.ts";
import { normalizeCompactOutputEnvelope } from "../../tests/fixtures/compact-output/normalize.ts";
import { createCompactOutputQueryCases } from "../../tests/fixtures/compact-output/queries.ts";
import { createCompactOutputTraceCases } from "../../tests/fixtures/compact-output/traces.ts";

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
function withoutContentReference(envelope) {
  if (!envelope.ok || !envelope.meta.contentReference) return envelope;
  const { contentReference, ...meta } = envelope.meta;
  return { ...envelope, meta };
}

const records = [];
const previousRuntimeDir = process.env.ASTROGRAPH_RUNTIME_DIR;
const runtimeDir = await mkdtemp(path.join(os.tmpdir(), "astrograph-compact-runtime-"));
process.env.ASTROGRAPH_RUNTIME_DIR = runtimeDir;
try {
  for (const name of fixtures) {
    const fixture = await createCompactOutputFixture(name);
    const indexed = await dispatchTool("index_folder", { repoRoot: fixture.repoRoot });
    if (!indexed.ok) throw new Error(`Could not index ${name}: ${indexed.error.message}`);
    const queries = createCompactOutputQueryCases(fixture);
    const queryById = new Map(queries.map((query) => [query.id, query]));
    for (const trace of createCompactOutputTraceCases(fixture, queries)) {
      const knownContentIds = new Set();
      const fullEnvelopes = new Map();
      for (const [step, queryId] of trace.queryIds.entries()) {
        const query = queryById.get(queryId);
        if (!query) throw new Error(`Unknown compact-output trace query: ${queryId}`);
        const started = performance.now();
        const session = trace.operationClass === "repeat-read"
          ? { capability: "content-references-v1", id: `benchmark_${name}_repeat`, knownContentIds: [...knownContentIds] }
          : undefined;
        const rawEnvelope = await dispatchTool(query.toolName, { ...query.args, ...(session ? { session } : {}) });
        const reference = rawEnvelope.ok ? rawEnvelope.meta.contentReference : undefined;
        if (reference) {
          knownContentIds.add(reference.id);
          if (reference.representation === "full") fullEnvelopes.set(reference.id, rawEnvelope);
        }
        const envelope = normalizeCompactOutputEnvelope(query.toolName, rawEnvelope, fixture.repoRoot);
        const canonicalRawEnvelope = reference?.representation === "reference"
          ? fullEnvelopes.get(reference.id) ?? rawEnvelope
          : rawEnvelope;
        const canonicalEnvelope = normalizeCompactOutputEnvelope(query.toolName, canonicalRawEnvelope, fixture.repoRoot);
        records.push({ fixture: name, trace: trace.id, operationClass: trace.operationClass, step: step + 1, query: query.id, toolName: query.toolName, expectedOk: query.expectsOk, elapsedMs: performance.now() - started, responseKind: reference?.representation ?? "full", delivered: json(envelope), canonical: json(canonicalEnvelope), agc1: agc1(query.toolName, withoutContentReference(canonicalEnvelope)) });
      }
    }
  }
} finally {
  const daemon = await readDaemonRuntime({ runtimeDir });
  if (daemon) {
    try { process.kill(daemon.pid, "SIGTERM"); } catch { /* Already stopped. */ }
  }
  await cleanupCompactOutputFixtures();
  await rm(runtimeDir, { recursive: true, force: true });
  if (previousRuntimeDir === undefined) delete process.env.ASTROGRAPH_RUNTIME_DIR;
  else process.env.ASTROGRAPH_RUNTIME_DIR = previousRuntimeDir;
}
const compact = records.filter((record) => record.agc1.reason === null);
const traces = Object.values(Object.groupBy(records, (record) => record.trace)).map((traceRecords) => ({
  fixture: traceRecords[0].fixture,
  trace: traceRecords[0].trace,
  operationClass: traceRecords[0].operationClass,
  captures: traceRecords.length,
  referenceCaptures: traceRecords.filter((record) => record.responseKind === "reference").length,
  deliveredJsonTokens: traceRecords.reduce((sum, record) => sum + record.delivered.tokens, 0),
  canonicalJsonTokens: traceRecords.reduce((sum, record) => sum + record.canonical.tokens, 0),
  referenceSavingsTokens: traceRecords.reduce((sum, record) => sum + record.canonical.tokens - record.delivered.tokens, 0),
  agc1Tokens: traceRecords.filter((record) => record.agc1.reason === null).reduce((sum, record) => sum + record.agc1.tokens, 0),
}));
const report = { schemaVersion: 3, corpus: "compact-output-repeat-read-traces-v1", tokenizer: BENCHMARK_TOKENIZER, records, traces, agc1Integrity: { eligibleSamples: compact.length, matchingSamples: compact.filter((record) => record.agc1.reason === null).length, failures: records.filter((record) => record.agc1.reason && record.agc1.reason !== "json_fallback" && record.agc1.reason !== "error_envelope").map((record) => ({ trace: record.trace, step: record.step, query: record.query, reason: record.agc1.reason })) }, aggregates: { deliveredJsonTokens: records.reduce((sum, record) => sum + record.delivered.tokens, 0), canonicalJsonTokens: records.reduce((sum, record) => sum + record.canonical.tokens, 0), referenceSavingsTokens: records.reduce((sum, record) => sum + record.canonical.tokens - record.delivered.tokens, 0), agc1Tokens: compact.reduce((sum, record) => sum + record.agc1.tokens, 0) } };
const { records: reportRecords, ...summary } = report;
summary.records = reportRecords.length;
process.stdout.write(`${JSON.stringify(process.argv.includes("--summary") ? summary : report, null, 2)}\n`);
