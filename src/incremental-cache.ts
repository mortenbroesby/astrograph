import { createHash } from "node:crypto";

import type { FileAnalysisTaskOutput } from "./file-analysis.ts";
import type { IndexBackendConnection } from "./index-backend.ts";
import type { SummaryStrategy } from "./types.ts";

export interface AnalysisArtifactFingerprintInput {
  contentHash: string;
  language: string;
  parserVersion: string;
  summaryStrategy: string;
  extractionConfigFingerprint: string;
  dependencyAnalysisVersion: string;
  storageSchemaVersion: number;
}

export interface AnalysisArtifactPayload {
  parseOutput: unknown;
  summaries: unknown;
  symbols: unknown;
  importFacts: unknown;
}

export interface AnalysisArtifactRecord extends AnalysisArtifactPayload {
  artifactKey: string;
  contentHash: string;
  language: string;
  parserVersion: string;
  summaryStrategy: string;
  extractionConfigFingerprint: string;
  dependencyAnalysisVersion: string;
  storageSchemaVersion: number;
  createdAt: string;
}

export interface SerializedAnalysisArtifactPayload {
  parse_output_json: string;
  summaries_json: string;
  symbols_json: string;
  import_facts_json: string;
}

export const ANALYSIS_PARSER_VERSION = "tree-sitter-v1";
export const ANALYSIS_DEPENDENCY_VERSION = "dependency-edges-v1";

interface StoredAnalysisArtifactRow {
  artifact_key: string;
  parse_output_json: string;
}

function hasJsonSerializableOwnProperty(
  value: object,
  field: keyof AnalysisArtifactPayload,
): boolean {
  return Object.hasOwn(value, field)
    && JSON.stringify((value as Record<string, unknown>)[field]) !== undefined;
}

function requireFingerprintString(
  field: string,
  value: string,
): string {
  if (value.trim().length === 0) {
    throw new Error(`Analysis artifact fingerprint field ${field} must be non-empty.`);
  }
  return value;
}

function normalizeFingerprintInput(
  input: AnalysisArtifactFingerprintInput,
): AnalysisArtifactFingerprintInput {
  if (!Number.isSafeInteger(input.storageSchemaVersion)
    || input.storageSchemaVersion <= 0) {
    throw new Error(
      "Analysis artifact fingerprint field storageSchemaVersion must be a positive integer.",
    );
  }

  return {
    contentHash: requireFingerprintString("contentHash", input.contentHash),
    language: requireFingerprintString("language", input.language),
    parserVersion: requireFingerprintString("parserVersion", input.parserVersion),
    summaryStrategy: requireFingerprintString("summaryStrategy", input.summaryStrategy),
    extractionConfigFingerprint: requireFingerprintString(
      "extractionConfigFingerprint",
      input.extractionConfigFingerprint,
    ),
    dependencyAnalysisVersion: requireFingerprintString(
      "dependencyAnalysisVersion",
      input.dependencyAnalysisVersion,
    ),
    storageSchemaVersion: input.storageSchemaVersion,
  };
}

export function buildAnalysisArtifactKey(
  input: AnalysisArtifactFingerprintInput,
): string {
  const fingerprint = normalizeFingerprintInput(input);
  const canonical = JSON.stringify({
    contentHash: fingerprint.contentHash,
    language: fingerprint.language,
    parserVersion: fingerprint.parserVersion,
    summaryStrategy: fingerprint.summaryStrategy,
    extractionConfigFingerprint: fingerprint.extractionConfigFingerprint,
    dependencyAnalysisVersion: fingerprint.dependencyAnalysisVersion,
    storageSchemaVersion: fingerprint.storageSchemaVersion,
  });

  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

export function isCompleteAnalysisArtifactRecord(
  value: unknown,
): value is AnalysisArtifactRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const stringFields = [
    "artifactKey",
    "contentHash",
    "language",
    "parserVersion",
    "summaryStrategy",
    "extractionConfigFingerprint",
    "dependencyAnalysisVersion",
    "createdAt",
  ];
  if (stringFields.some((field) => typeof candidate[field] !== "string"
    || candidate[field].trim().length === 0)) {
    return false;
  }

  return Number.isSafeInteger(candidate.storageSchemaVersion)
    && (candidate.storageSchemaVersion as number) > 0
    && hasJsonSerializableOwnProperty(candidate, "parseOutput")
    && hasJsonSerializableOwnProperty(candidate, "summaries")
    && hasJsonSerializableOwnProperty(candidate, "symbols")
    && hasJsonSerializableOwnProperty(candidate, "importFacts");
}

function serializePayloadField(name: string, value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error(`Analysis artifact payload field ${name} must be JSON serializable.`);
  }
  return serialized;
}

export function serializeAnalysisArtifactPayload(
  payload: AnalysisArtifactPayload,
): SerializedAnalysisArtifactPayload {
  return {
    parse_output_json: serializePayloadField("parseOutput", payload.parseOutput),
    summaries_json: serializePayloadField("summaries", payload.summaries),
    symbols_json: serializePayloadField("symbols", payload.symbols),
    import_facts_json: serializePayloadField("importFacts", payload.importFacts),
  };
}

function parseStoredAnalysis(value: string): FileAnalysisTaskOutput | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const candidate = parsed as Partial<FileAnalysisTaskOutput>;
    if (!candidate.parsed || typeof candidate.parsed !== "object"
      || typeof candidate.symbolSignatureHash !== "string"
      || typeof candidate.importHash !== "string") {
      return null;
    }
    return candidate as FileAnalysisTaskOutput;
  } catch {
    return null;
  }
}

export function buildIndexingExtractionConfigFingerprint(
  summaryStrategy: SummaryStrategy | undefined,
): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify({ summaryStrategy: summaryStrategy ?? "doc-comments-first" }))
    .digest("hex")}`;
}

export function loadAnalysisArtifact(
  db: IndexBackendConnection,
  artifactKey: string,
): FileAnalysisTaskOutput | null {
  const row = db.prepare(
    "SELECT artifact_key, parse_output_json FROM analysis_artifacts WHERE artifact_key = ?",
  ).get(artifactKey) as StoredAnalysisArtifactRow | undefined;
  return row ? parseStoredAnalysis(row.parse_output_json) : null;
}

export function storeAnalysisArtifact(input: {
  db: IndexBackendConnection;
  fingerprint: AnalysisArtifactFingerprintInput;
  analysis: FileAnalysisTaskOutput;
  now?: string;
}): string {
  const artifactKey = buildAnalysisArtifactKey(input.fingerprint);
  const payload = serializeAnalysisArtifactPayload({
    parseOutput: input.analysis,
    summaries: input.analysis.parsed.symbols.map((symbol) => ({
      id: symbol.id,
      summary: symbol.summary,
    })),
    symbols: input.analysis.parsed.symbols,
    importFacts: input.analysis.parsed.imports,
  });
  input.db.prepare(`
    INSERT OR IGNORE INTO analysis_artifacts (
      artifact_key, content_hash, language, parser_version, summary_strategy,
      extraction_config_fingerprint, dependency_analysis_version,
      storage_schema_version, parse_output_json, summaries_json, symbols_json,
      import_facts_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    artifactKey,
    input.fingerprint.contentHash,
    input.fingerprint.language,
    input.fingerprint.parserVersion,
    input.fingerprint.summaryStrategy,
    input.fingerprint.extractionConfigFingerprint,
    input.fingerprint.dependencyAnalysisVersion,
    input.fingerprint.storageSchemaVersion,
    payload.parse_output_json,
    payload.summaries_json,
    payload.symbols_json,
    payload.import_facts_json,
    input.now ?? new Date().toISOString(),
  );
  return artifactKey;
}

export function resolveAnalysisArtifact(input: {
  db: IndexBackendConnection;
  fingerprint: AnalysisArtifactFingerprintInput;
  analyze(): FileAnalysisTaskOutput;
}): { analysis: FileAnalysisTaskOutput; reused: boolean; artifactKey: string } {
  const artifactKey = buildAnalysisArtifactKey(input.fingerprint);
  const cached = loadAnalysisArtifact(input.db, artifactKey);
  if (cached) {
    return { analysis: cached, reused: true, artifactKey };
  }

  const analysis = input.analyze();
  storeAnalysisArtifact({
    db: input.db,
    fingerprint: input.fingerprint,
    analysis,
  });
  return { analysis, reused: false, artifactKey };
}
