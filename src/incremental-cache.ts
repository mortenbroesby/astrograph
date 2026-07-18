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
