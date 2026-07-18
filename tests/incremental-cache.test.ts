import { describe, expect, it } from "vitest";

import {
  serializeAnalysisArtifactPayload,
} from "../src/incremental-cache.ts";
import { SQLITE_INDEX_BACKEND } from "../src/sqlite-backend.ts";
import { initializeDatabase } from "../src/storage-schema.ts";
import { typedGet } from "../src/storage-queries.ts";

describe("incremental analysis artifact storage", () => {
  it("initializes private artifact storage and accepts a complete payload", () => {
    const db = SQLITE_INDEX_BACKEND.open(":memory:");
    initializeDatabase(db);

    const payload = serializeAnalysisArtifactPayload({
      parseOutput: { parser: "oxc", version: 1 },
      summaries: [{ symbol: "area", summary: "Computes area." }],
      symbols: [{ id: "symbol-area", name: "area" }],
      importFacts: [{ source: "./math.ts", specifiers: ["area"] }],
    });

    db.prepare(`
      INSERT INTO analysis_artifacts (
        artifact_key,
        content_hash,
        language,
        parser_version,
        summary_strategy,
        extraction_config_fingerprint,
        dependency_analysis_version,
        storage_schema_version,
        parse_output_json,
        summaries_json,
        symbols_json,
        import_facts_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "artifact-key",
      "content-hash",
      "typescript",
      "oxc-v1",
      "doc-comments-first",
      "config-v1",
      "dependencies-v1",
      4,
      payload.parse_output_json,
      payload.summaries_json,
      payload.symbols_json,
      payload.import_facts_json,
      "2026-07-18T00:00:00.000Z",
    );

    const row = typedGet<{
      name: string;
      symbols_json: string;
      import_facts_json: string;
    }>(
      db.prepare(`
        SELECT sqlite_master.name, analysis_artifacts.symbols_json,
          analysis_artifacts.import_facts_json
        FROM sqlite_master
        INNER JOIN analysis_artifacts ON 1 = 1
        WHERE sqlite_master.type = 'table'
          AND sqlite_master.name = 'analysis_artifacts'
      `),
    );
    db.close();

    expect(row).toEqual({
      name: "analysis_artifacts",
      symbols_json: JSON.stringify([{ id: "symbol-area", name: "area" }]),
      import_facts_json: JSON.stringify([
        { source: "./math.ts", specifiers: ["area"] },
      ]),
    });
  });

  it("rejects non-serializable artifact payload fields", () => {
    expect(() => serializeAnalysisArtifactPayload({
      parseOutput: undefined,
      summaries: [],
      symbols: [],
      importFacts: [],
    })).toThrow("parseOutput must be JSON serializable");
  });
});
