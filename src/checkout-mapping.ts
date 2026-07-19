import { randomUUID } from "node:crypto";
import path from "node:path";

import type { GitCheckoutMode } from "./git-checkout.ts";
import type { IndexBackendConnection } from "./index-backend.ts";
import { normalizeRepoRelativePath } from "./path-matcher.ts";
import { typedGet } from "./storage-queries.ts";

export interface CheckoutRecord {
  checkoutId: string;
  canonicalRoot: string;
  gitMode: GitCheckoutMode;
  repositoryId: string | null;
  headOid: string | null;
  branchRef: string | null;
  worktreePath: string | null;
  gitDiagnostic: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutPathMapping {
  checkoutId: string;
  relativePath: string;
  artifactKey: string;
  observedContentHash: string;
  observedSizeBytes: number | null;
  observedMtimeMs: number | null;
  observedAt: string;
}

function requireNonEmpty(value: string, label: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = path.normalize(relativePath);
  if (path.isAbsolute(relativePath)
    || normalized === ".."
    || normalized.startsWith(`..${path.sep}`)) {
    throw new Error("Checkout mapping path must be repository-relative.");
  }
  return normalizeRepoRelativePath(normalized);
}

function mapCheckoutRow(row: {
  checkout_id: string;
  canonical_root: string;
  git_mode: GitCheckoutMode;
  repository_id: string | null;
  head_oid: string | null;
  branch_ref: string | null;
  worktree_path: string | null;
  git_diagnostic: string | null;
  created_at: string;
  updated_at: string;
}): CheckoutRecord {
  return {
    checkoutId: row.checkout_id,
    canonicalRoot: row.canonical_root,
    gitMode: row.git_mode,
    repositoryId: row.repository_id,
    headOid: row.head_oid,
    branchRef: row.branch_ref,
    worktreePath: row.worktree_path,
    gitDiagnostic: row.git_diagnostic,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function registerCheckout(
  db: IndexBackendConnection,
  input: Omit<CheckoutRecord, "checkoutId" | "createdAt" | "updatedAt"> & {
    now?: string;
  },
): CheckoutRecord {
  const canonicalRoot = requireNonEmpty(input.canonicalRoot, "Checkout root");
  const now = input.now ?? new Date().toISOString();
  const existing = typedGet<{ checkout_id: string }>(
    db.prepare("SELECT checkout_id FROM checkouts WHERE canonical_root = ?"),
    canonicalRoot,
  );
  const checkoutId = existing?.checkout_id ?? randomUUID();

  db.prepare(`
    INSERT INTO checkouts (
      checkout_id, canonical_root, git_mode, repository_id, head_oid, branch_ref,
      worktree_path, git_diagnostic, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(canonical_root) DO UPDATE SET
      git_mode = excluded.git_mode,
      repository_id = excluded.repository_id,
      head_oid = excluded.head_oid,
      branch_ref = excluded.branch_ref,
      worktree_path = excluded.worktree_path,
      git_diagnostic = excluded.git_diagnostic,
      updated_at = excluded.updated_at
  `).run(
    checkoutId,
    canonicalRoot,
    input.gitMode,
    input.repositoryId,
    input.headOid,
    input.branchRef,
    input.worktreePath,
    input.gitDiagnostic,
    now,
    now,
  );

  return getCheckoutByCanonicalRoot(db, canonicalRoot)!;
}

export function getCheckoutByCanonicalRoot(
  db: IndexBackendConnection,
  canonicalRoot: string,
): CheckoutRecord | null {
  const row = typedGet<Parameters<typeof mapCheckoutRow>[0]>(
    db.prepare("SELECT * FROM checkouts WHERE canonical_root = ?"),
    canonicalRoot,
  );
  return row ? mapCheckoutRow(row) : null;
}

export function upsertCheckoutPathMapping(
  db: IndexBackendConnection,
  input: CheckoutPathMapping,
): void {
  db.prepare(`
    INSERT INTO checkout_path_mappings (
      checkout_id, relative_path, artifact_key, observed_content_hash,
      observed_size_bytes, observed_mtime_ms, observed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(checkout_id, relative_path) DO UPDATE SET
      artifact_key = excluded.artifact_key,
      observed_content_hash = excluded.observed_content_hash,
      observed_size_bytes = excluded.observed_size_bytes,
      observed_mtime_ms = excluded.observed_mtime_ms,
      observed_at = excluded.observed_at
  `).run(
    requireNonEmpty(input.checkoutId, "Checkout ID"),
    normalizeRelativePath(input.relativePath),
    requireNonEmpty(input.artifactKey, "Artifact key"),
    requireNonEmpty(input.observedContentHash, "Observed content hash"),
    input.observedSizeBytes,
    input.observedMtimeMs,
    requireNonEmpty(input.observedAt, "Observed timestamp"),
  );
}
