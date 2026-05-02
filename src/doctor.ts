import { loadRepoEngineConfig } from "./config.ts";
import type { RepoMetaHealth, RepoMetaHealthStatus } from "./repo-meta.ts";
import type { IndexBackendConnection } from "./index-backend.ts";
import { containsSecretLikeText } from "./privacy.ts";
import type { DoctorResult, DiagnosticsResult } from "./types.ts";
import { countRows, typedAll, typedGet } from "./storage-queries.ts";
import type { ImportSpecifier } from "./types.ts";

function normalizeImportSpecifier(value: unknown): ImportSpecifier | null {
  if (typeof value === "string") {
    const importedName = value.trim();
    return importedName
      ? {
          kind: "unknown",
          importedName,
          localName: null,
        }
      : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const kind = "kind" in value ? value.kind : null;
  const importedName = "importedName" in value ? value.importedName : null;
  const localName = "localName" in value ? value.localName : null;

  if (
    (kind !== "named" && kind !== "default" && kind !== "namespace" && kind !== "unknown")
    || typeof importedName !== "string"
    || importedName.trim().length === 0
  ) {
    return null;
  }

  return {
    kind,
    importedName: importedName.trim(),
    localName: typeof localName === "string" && localName.trim().length > 0
      ? localName.trim()
      : null,
  };
}

function parseStoredImportSpecifiers(serialized: string): ImportSpecifier[] {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => normalizeImportSpecifier(entry))
      .filter((entry): entry is ImportSpecifier => entry !== null);
  } catch {
    return [];
  }
}

export function loadDependencyGraphHealth(
  db: IndexBackendConnection,
): DoctorResult["dependencyGraph"] {
  const brokenDependencyRows = typedAll<{
    importer_path: string;
    source: string;
  }>(
    db.prepare(`
      SELECT files.path AS importer_path, imports.source AS source
      FROM imports
      INNER JOIN files ON files.id = imports.file_id
      LEFT JOIN file_dependencies
        ON file_dependencies.importer_file_id = imports.file_id
        AND file_dependencies.source = imports.source
      WHERE (imports.source LIKE './%' OR imports.source LIKE '../%' OR imports.source LIKE '/%')
        AND file_dependencies.target_path IS NULL
      ORDER BY files.path ASC, imports.source ASC
    `),
  );
  const affectedImporters = [...new Set(
    brokenDependencyRows.map((row) => row.importer_path),
  )];
  const brokenRelativeSymbolRows = typedAll<{
    importer_path: string;
    target_path: string;
    specifiers: string;
  }>(
    db.prepare(`
      SELECT
        file_dependencies.importer_path AS importer_path,
        file_dependencies.target_path AS target_path,
        imports.specifiers AS specifiers
      FROM file_dependencies
      INNER JOIN files ON files.id = file_dependencies.importer_file_id
      INNER JOIN imports
        ON imports.file_id = files.id
        AND imports.source = file_dependencies.source
      WHERE file_dependencies.source LIKE './%'
        OR file_dependencies.source LIKE '../%'
        OR file_dependencies.source LIKE '/%'
      ORDER BY file_dependencies.importer_path ASC, file_dependencies.target_path ASC
    `),
  );

  const brokenRelativeSymbolImporters = new Set<string>();
  let brokenRelativeSymbolImportCount = 0;

  for (const row of brokenRelativeSymbolRows) {
    const missingNamedSpecifiers = parseStoredImportSpecifiers(row.specifiers)
      .filter((specifier) => specifier.kind === "named")
      .filter((specifier) => {
        const exportedSymbol = typedGet<{ id: string }>(
          db.prepare(
            `
              SELECT id
              FROM symbols
              WHERE file_path = ?
                AND exported = 1
                AND (name = ? OR qualified_name = ?)
              LIMIT 1
            `,
          ),
          row.target_path,
          specifier.importedName,
          specifier.importedName,
        );
        return !exportedSymbol;
      });

    if (missingNamedSpecifiers.length === 0) {
      continue;
    }

    brokenRelativeSymbolImportCount += missingNamedSpecifiers.length;
    brokenRelativeSymbolImporters.add(row.importer_path);
  }

  const allAffectedImporters = [...new Set([
    ...affectedImporters,
    ...brokenRelativeSymbolImporters,
  ])];
  const sampleImporterPaths = allAffectedImporters.slice(0, 5);

  return {
    brokenRelativeImportCount: brokenDependencyRows.length,
    brokenRelativeSymbolImportCount,
    affectedImporterCount: allAffectedImporters.length,
    sampleImporterPaths,
  };
}

export function loadPrivacyHealth(
  db: IndexBackendConnection,
): DoctorResult["privacy"] {
  const rows = typedAll<{ file_path: string; content: string }>(
    db.prepare(`
      SELECT files.path AS file_path, content_blobs.content AS content
      FROM content_blobs
      INNER JOIN files ON files.id = content_blobs.file_id
      ORDER BY files.path ASC
    `),
  );
  const sampleFilePaths: string[] = [];
  let secretLikeFileCount = 0;

  for (const row of rows) {
    if (!containsSecretLikeText(row.content)) {
      continue;
    }

    secretLikeFileCount += 1;
    if (sampleFilePaths.length < 5) {
      sampleFilePaths.push(row.file_path);
    }
  }

  return {
    secretLikeFileCount,
    sampleFilePaths,
  };
}

export function buildDoctorWarnings(result: DoctorResult): string[] {
  const warnings: string[] = [];

  if (result.indexStatus === "not-indexed") {
    warnings.push("No Astrograph index was found for this repository yet.");
  }
  if (result.indexStatus === "stale") {
    warnings.push("Indexed repository data is stale.");
  }
  if (result.parser.unknownFileCount > 0) {
    warnings.push(
      `Parser health is unavailable for ${result.parser.unknownFileCount} indexed file(s) created before parser metrics were recorded.`,
    );
  }
  if ((result.parser.fallbackRate ?? 0) > 0) {
    warnings.push(
      `Parser fallback was used for ${result.parser.fallbackFileCount} of ${result.parser.indexedFileCount} indexed file(s).`,
    );
  }
  if (result.dependencyGraph.brokenRelativeImportCount > 0) {
    warnings.push(
      `Dependency graph contains ${result.dependencyGraph.brokenRelativeImportCount} unresolved relative import(s) across ${result.dependencyGraph.affectedImporterCount} importer file(s).`,
    );
  }
  if (result.dependencyGraph.brokenRelativeSymbolImportCount > 0) {
    warnings.push(
      `Dependency graph contains ${result.dependencyGraph.brokenRelativeSymbolImportCount} unresolved relative symbol import(s).`,
    );
  }
  if (result.privacy.secretLikeFileCount > 0) {
    warnings.push(
      `Indexed source contains ${result.privacy.secretLikeFileCount} file(s) with obvious secret-like content.`,
    );
  }
  if (result.watch.status !== "watching") {
    warnings.push("Watch mode is not currently running.");
  }

  return warnings;
}

export function buildMetaHealthWarnings(status: RepoMetaHealthStatus): string[] {
  switch (status) {
    case "unreadable":
      return ["Index metadata is unreadable."];
    case "missing-integrity":
      return ["Index metadata integrity file is missing."];
    case "integrity-mismatch":
      return ["Index metadata integrity check failed."];
    default:
      return [];
  }
}

export function buildDoctorSuggestedActions(result: DoctorResult): string[] {
  const actions: string[] = [];

  if (result.indexStatus === "not-indexed") {
    actions.push(`Run \`pnpm exec astrograph cli index-folder --repo ${result.repoRoot}\` to create the initial index.`);
  }
  if (result.indexStatus === "stale") {
    actions.push(`Run \`pnpm exec astrograph cli index-folder --repo ${result.repoRoot}\` to refresh the stale index.`);
  }
  if (result.parser.unknownFileCount > 0) {
    actions.push("Reindex the repository to backfill parser health metrics on older indexed files.");
  }
  if (result.dependencyGraph.brokenRelativeImportCount > 0) {
    const sample = result.dependencyGraph.sampleImporterPaths[0];
    actions.push(
      sample
        ? `Fix or reindex importer paths such as \`${sample}\` so Astrograph can resolve their relative dependencies again.`
        : "Fix or reindex importer paths with unresolved relative dependencies.",
    );
  }
  if (result.dependencyGraph.brokenRelativeSymbolImportCount > 0) {
    const sample = result.dependencyGraph.sampleImporterPaths[0];
    actions.push(
      sample
        ? `Update importer paths such as \`${sample}\` or restore the expected exported symbols in their relative dependencies.`
        : "Update importer paths or restore the expected exported symbols in their relative dependencies.",
    );
  }
  if (result.privacy.secretLikeFileCount > 0) {
    const sample = result.privacy.sampleFilePaths[0];
    actions.push(
      sample
        ? `Review indexed file(s) such as \`${sample}\` and remove or rotate any real secrets that should not live in source.`
        : "Review indexed files with secret-like content and remove or rotate any real secrets that should not live in source.",
    );
  }
  if (result.watch.status !== "watching") {
    actions.push(`Run \`pnpm exec astrograph cli watch --repo ${result.repoRoot}\` if you want automatic local refresh while editing.`);
  }

  return actions;
}

export function buildMetaHealthSuggestedActions(
  repoRoot: string,
  status: RepoMetaHealthStatus,
): string[] {
  switch (status) {
    case "unreadable":
    case "missing-integrity":
    case "integrity-mismatch":
      return [
        `Rebuild Astrograph metadata with \`pnpm exec astrograph cli index-folder --repo ${repoRoot}\` because the repo-local metadata sidecars are corrupted or incomplete.`,
      ];
    default:
      return [];
  }
}

export async function resolveDoctorObservability(
  repoRoot: string,
): Promise<DoctorResult["observability"]> {
  const repoConfig = await loadRepoEngineConfig(repoRoot, { repoRootResolved: true });

  if (!repoConfig.observability.enabled) {
    return {
      enabled: false,
      configuredHost: repoConfig.observability.host,
      configuredPort: repoConfig.observability.port,
      status: "disabled",
      url: null,
    };
  }

  return {
    enabled: true,
    configuredHost: repoConfig.observability.host,
    configuredPort: repoConfig.observability.port,
    status: "recording",
    url: null,
  };
}

export interface DoctorBuildInput {
  resolvedRepoRoot: string;
  diagnostics: DiagnosticsResult;
  db: IndexBackendConnection;
  metaHealth: RepoMetaHealth;
}

export async function buildDoctorResult(
  input: DoctorBuildInput,
): Promise<DoctorResult> {
  const importCount = countRows(input.db, "SELECT COUNT(*) AS count FROM imports");
  const dependencyGraph = loadDependencyGraphHealth(input.db);
  const privacy = loadPrivacyHealth(input.db);
  const observability = await resolveDoctorObservability(input.resolvedRepoRoot);

  const result: DoctorResult = {
    repoRoot: input.resolvedRepoRoot,
    storageDir: input.diagnostics.storageDir,
    databasePath: input.diagnostics.databasePath,
    storageVersion: input.diagnostics.storageVersion,
    schemaVersion: input.diagnostics.schemaVersion,
    storageBackend: input.diagnostics.storageBackend,
    storageMode: input.diagnostics.storageMode,
    indexStatus:
      input.diagnostics.indexedAt === null && input.diagnostics.indexedFiles === 0
        ? "not-indexed"
        : input.diagnostics.staleStatus === "stale"
          ? "stale"
          : "indexed",
    freshness: {
      status: input.diagnostics.staleStatus,
      mode: input.diagnostics.freshnessMode,
      scanned: input.diagnostics.freshnessScanned,
      indexedAt: input.diagnostics.indexedAt,
      indexAgeMs: input.diagnostics.indexAgeMs,
      indexedFiles: input.diagnostics.indexedFiles,
      currentFiles: input.diagnostics.currentFiles,
      indexedSymbols: input.diagnostics.indexedSymbols,
      indexedImports: importCount,
      missingFiles: input.diagnostics.missingFiles,
      changedFiles: input.diagnostics.changedFiles,
      extraFiles: input.diagnostics.extraFiles,
    },
    parser: {
      ...input.diagnostics.parser,
    },
    dependencyGraph,
    observability,
    privacy,
    watch: input.diagnostics.watch,
    warnings: [],
    suggestedActions: [],
  };

  result.warnings = [
    ...buildDoctorWarnings(result),
    ...buildMetaHealthWarnings(input.metaHealth.status),
  ];
  result.suggestedActions = [
    ...buildDoctorSuggestedActions(result),
    ...buildMetaHealthSuggestedActions(result.repoRoot, input.metaHealth.status),
  ];
  return result;
}
