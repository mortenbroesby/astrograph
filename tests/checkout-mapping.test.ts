import { describe, expect, it } from "vitest";

import {
  getCheckoutByCanonicalRoot,
  registerCheckout,
  upsertCheckoutPathMapping,
} from "../src/checkout-mapping.ts";
import { SQLITE_INDEX_BACKEND } from "../src/sqlite-backend.ts";
import { initializeDatabase } from "../src/storage-schema.ts";
import { typedAll } from "../src/storage-queries.ts";

function insertArtifact(db: ReturnType<typeof SQLITE_INDEX_BACKEND.open>) {
  db.prepare(`
    INSERT INTO analysis_artifacts (
      artifact_key, content_hash, language, parser_version, summary_strategy,
      extraction_config_fingerprint, dependency_analysis_version,
      storage_schema_version, parse_output_json, summaries_json, symbols_json,
      import_facts_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "artifact-shared",
    "content-hash",
    "typescript",
    "parser-v1",
    "doc-comments-first",
    "config-v1",
    "dependency-v1",
    6,
    "{}",
    "[]",
    "[]",
    "[]",
    "2026-07-18T00:00:00.000Z",
  );
}

describe("checkout mappings", () => {
  it("keeps worktree mappings distinct while sharing an artifact", () => {
    const db = SQLITE_INDEX_BACKEND.open(":memory:");
    initializeDatabase(db);
    insertArtifact(db);

    const main = registerCheckout(db, {
      canonicalRoot: "/repo/main",
      gitMode: "git-branch",
      repositoryId: "repo-id",
      headOid: "head-main",
      branchRef: "main",
      worktreePath: "/repo/main",
      gitDiagnostic: null,
      now: "2026-07-18T00:00:00.000Z",
    });
    const feature = registerCheckout(db, {
      canonicalRoot: "/repo/feature",
      gitMode: "git-worktree",
      repositoryId: "repo-id",
      headOid: "head-feature",
      branchRef: "feature/cache",
      worktreePath: "/repo/feature",
      gitDiagnostic: null,
      now: "2026-07-18T00:00:01.000Z",
    });
    upsertCheckoutPathMapping(db, {
      checkoutId: main.checkoutId,
      relativePath: "src/math.ts",
      artifactKey: "artifact-shared",
      observedContentHash: "content-hash",
      observedSizeBytes: 42,
      observedMtimeMs: 1,
      observedAt: "2026-07-18T00:00:00.000Z",
    });
    upsertCheckoutPathMapping(db, {
      checkoutId: feature.checkoutId,
      relativePath: "src/math.ts",
      artifactKey: "artifact-shared",
      observedContentHash: "content-hash",
      observedSizeBytes: 42,
      observedMtimeMs: 2,
      observedAt: "2026-07-18T00:00:01.000Z",
    });

    const mappings = typedAll<{
      checkout_id: string;
      artifact_key: string;
      observed_mtime_ms: number;
    }>(db.prepare(`
      SELECT checkout_id, artifact_key, observed_mtime_ms
      FROM checkout_path_mappings
      ORDER BY checkout_id ASC
    `));
    db.close();

    expect(main.checkoutId).not.toBe(feature.checkoutId);
    expect(mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({ checkout_id: main.checkoutId, artifact_key: "artifact-shared" }),
      expect.objectContaining({ checkout_id: feature.checkoutId, artifact_key: "artifact-shared" }),
    ]));
  });

  it("preserves checkout identity while refreshing Git observations", () => {
    const db = SQLITE_INDEX_BACKEND.open(":memory:");
    initializeDatabase(db);
    const original = registerCheckout(db, {
      canonicalRoot: "/repo/main",
      gitMode: "git-branch",
      repositoryId: null,
      headOid: "old",
      branchRef: "main",
      worktreePath: "/repo/main",
      gitDiagnostic: null,
      now: "2026-07-18T00:00:00.000Z",
    });
    const refreshed = registerCheckout(db, {
      ...original,
      gitMode: "git-detached",
      repositoryId: null,
      headOid: "new",
      branchRef: null,
      worktreePath: "/repo/main",
      gitDiagnostic: null,
      now: "2026-07-18T00:00:02.000Z",
    });

    expect(refreshed.checkoutId).toBe(original.checkoutId);
    expect(getCheckoutByCanonicalRoot(db, "/repo/main")).toMatchObject({
      checkoutId: original.checkoutId,
      headOid: "new",
      branchRef: null,
    });
    db.close();
  });
});
