import { createHash } from "node:crypto";

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
