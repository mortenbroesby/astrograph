import { spawn } from "node:child_process";
import { mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it as baseIt } from "vitest";

import {
  ASTROGRAPH_PACKAGE_VERSION,
  ASTROGRAPH_VERSION_PARTS,
  diagnostics,
  doctor,
  getContextBundle,
  getFileContent,
  getFileOutline,
  getFileTree,
  getRepoOutline,
  getRankedContext,
  getSymbolSource,
  indexFolder,
  indexFile,
  queryCode,
  searchSymbols,
  searchText,
  suggestInitialQueries,
  watchFolder,
} from "../src/index.ts";
import { resolveEnginePaths } from "../src/config.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

afterEach(async () => {
  await cleanupFixtureRepos();
});

function snapshotIndexedRows(repoRoot: string) {
  const paths = resolveEnginePaths(repoRoot);
  const db = new Database(paths.databasePath, { readonly: true });
  const files = db.prepare(
    `
      SELECT
        path,
        language,
        content_hash,
        integrity_hash,
        size_bytes,
        symbol_signature_hash,
        import_hash,
        parser_backend,
        parser_fallback_used,
        parser_fallback_reason,
        symbol_count
      FROM files
      ORDER BY path ASC
    `,
  ).all();
  const symbols = db.prepare(
    `
      SELECT
        file_path,
        name,
        qualified_name,
        kind,
        signature,
        summary,
        summary_source,
        start_line,
        end_line,
        exported
      FROM symbols
      ORDER BY file_path ASC, start_line ASC, name ASC
    `,
  ).all();
  const imports = db.prepare(
    `
      SELECT
        files.path AS file_path,
        imports.source,
        imports.specifiers
      FROM imports
      INNER JOIN files ON files.id = imports.file_id
      ORDER BY files.path ASC, imports.source ASC
    `,
  ).all();
  db.close();

  return { files, symbols, imports };
}

function readIndexedFileUpdatedAt(repoRoot: string, filePath: string): string | null {
  const paths = resolveEnginePaths(repoRoot);
  const db = new Database(paths.databasePath, { readonly: true });
  const row = db.prepare(
    "SELECT updated_at FROM files WHERE path = ?",
  ).get(filePath) as { updated_at: string } | undefined;
  db.close();
  return row?.updated_at ?? null;
}

describe("ai-context-engine behavior", () => {
  const it = (name: string, fn: (...args: never[]) => unknown, timeout = 15000) =>
    baseIt(name, fn as never, timeout);
  const slowIt =
    process.env.ASTROGRAPH_ENABLE_SLOW_TESTS === "1"
      ? it
      : baseIt.skip;

  async function waitFor(
    predicate: () => boolean | Promise<boolean>,
    timeoutMs = 2000,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!(await predicate())) {
      if (Date.now() > deadline) {
        throw new Error("Timed out waiting for condition");
      }
      await delay(20);
    }
  }

  it("indexes a folder and exposes discovery-first queries", async () => {
    const repoRoot = await createFixtureRepo();

    const summary = await indexFolder({ repoRoot });

    expect(summary).toMatchObject({
      indexedFiles: 2,
      indexedSymbols: 5,
      staleStatus: "fresh",
    });

    const repoOutline = await getRepoOutline({ repoRoot });
    expect(repoOutline.totalFiles).toBe(2);
    expect(repoOutline.languages.ts).toBe(2);
    expect(repoOutline.totalSymbols).toBe(5);

    const fileTree = await getFileTree({ repoRoot });
    expect(fileTree.map((file) => file.path)).toEqual([
      "src/math.ts",
      "src/strings.ts",
    ]);

    const fileOutline = await getFileOutline({
      repoRoot,
      filePath: "src/strings.ts",
    });
    expect(fileOutline.symbols.map((symbol) => symbol.name)).toEqual([
      "formatLabel",
      "Greeter",
      "greet",
    ]);

    const suggestions = await suggestInitialQueries({ repoRoot });
    expect(suggestions[0]).toContain("Greeter");
  });

  slowIt("reports discovery-ready deepening state before deep retrieval finishes", async () => {
    const repoRoot = await createFixtureRepo();
    for (let index = 0; index < 4; index += 1) {
      await writeFile(
        path.join(repoRoot, "src", `extra-${index}.ts`),
        `export function extra${index}(value: number) {\n  return value + ${index};\n}\n`,
      );
    }

    const child = spawn(
      process.execPath,
      [path.join(packageRoot, "scripts", "ai-context-engine.mjs"), "index-folder", "--repo", repoRoot],
      {
        cwd: packageRoot,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          ASTROGRAPH_USE_SOURCE: "1",
          ASTROGRAPH_INDEX_TEST_DELAY_MS: "1000",
          AI_CONTEXT_ENGINE_INDEX_WORKER_CHILD: "1",
        },
      },
    );

    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    try {
      await waitFor(async () => {
        const health = await diagnostics({ repoRoot });
        return health.readiness.stage === "deepening";
      }, 5_000);

      const deepeningHealth = await diagnostics({ repoRoot });
      expect(deepeningHealth.readiness).toMatchObject({
        stage: "deepening",
        discoveryReady: true,
        deepRetrievalReady: false,
        deepening: true,
        discoveredFiles: 6,
        deepIndexedFiles: 0,
        pendingDeepIndexedFiles: 6,
      });
      expect(deepeningHealth.staleStatus).toBe("unknown");

      const [code] = await once(child, "close");
      expect(code).toBe(0);
      expect(stderr).toBe("");

      const finalHealth = await diagnostics({ repoRoot });
      expect(finalHealth.readiness).toMatchObject({
        stage: "deep-retrieval-ready",
        discoveryReady: true,
        deepRetrievalReady: true,
        deepening: false,
        discoveredFiles: 6,
        deepIndexedFiles: 6,
        pendingDeepIndexedFiles: 0,
      });
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        await once(child, "close").catch(() => undefined);
      }
    }
  }, 30_000);

  it("doctor gives useful guidance before the repo has been indexed", async () => {
    const repoRoot = await createFixtureRepo();
    const resolvedRepoRoot = await realpath(repoRoot);

    const result = await doctor({ repoRoot });

    expect(result).toMatchObject({
      repoRoot: resolvedRepoRoot,
      schemaVersion: 4,
      indexStatus: "not-indexed",
      freshness: {
        indexedFiles: 0,
        indexedSymbols: 0,
        indexedImports: 0,
      },
      parser: {
        indexedFileCount: 0,
        fallbackFileCount: 0,
        fallbackRate: null,
      },
      dependencyGraph: {
        brokenRelativeImportCount: 0,
        brokenRelativeSymbolImportCount: 0,
        affectedImporterCount: 0,
      },
      observability: {
        enabled: false,
        status: "disabled",
      },
    });
    expect(result.warnings).toContain(
      "No Astrograph index was found for this repository yet.",
    );
    expect(result.suggestedActions[0]).toContain("index-folder");
  });

  it("prefers leading doc comments for symbol summaries by default", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    const mathOutline = await getFileOutline({
      repoRoot,
      filePath: "src/math.ts",
    });
    expect(mathOutline.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "area",
          summary: "Calculate the circle area label.",
          summarySource: "doc-comment",
        }),
      ]),
    );

    const stringsOutline = await getFileOutline({
      repoRoot,
      filePath: "src/strings.ts",
    });
    expect(stringsOutline.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "formatLabel",
          summary: "Format an area label for display.",
          summarySource: "doc-comment",
        }),
        expect.objectContaining({
          name: "Greeter",
          summary: "Friendly greeter for string output.",
          summarySource: "doc-comment",
        }),
        expect.objectContaining({
          name: "greet",
          summary: "Return a greeting for the provided name.",
          summarySource: "doc-comment",
        }),
      ]),
    );

    const health = await diagnostics({ repoRoot });
    expect(health).toMatchObject({
      engineVersion: ASTROGRAPH_PACKAGE_VERSION,
      engineVersionParts: ASTROGRAPH_VERSION_PARTS,
      schemaVersion: 4,
      summaryStrategy: "doc-comments-first",
      summarySources: {
        "doc-comment": 4,
        signature: 1,
      },
      parser: {
        primaryBackend: "oxc",
        fallbackBackend: "tree-sitter",
        indexedFileCount: 2,
        fallbackFileCount: 0,
        fallbackRate: 0,
        unknownFileCount: 0,
      },
      dependencyGraph: {
        brokenRelativeImportCount: 0,
        brokenRelativeSymbolImportCount: 0,
        affectedImporterCount: 0,
      },
      watch: {
        status: "idle",
        lastEvent: null,
        reindexCount: 0,
      },
    });
  });

  it("can fall back to signature-derived summaries when configured", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({
      repoRoot,
      summaryStrategy: "signature-only",
    });

    const mathOutline = await getFileOutline({
      repoRoot,
      filePath: "src/math.ts",
    });
    expect(mathOutline.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "area",
          summary:
            "export function area(radius: number): string { const value = PI * radius * radius; return formatLabel(value); }",
          summarySource: "signature",
        }),
      ]),
    );

    const health = await diagnostics({ repoRoot });
    expect(health).toMatchObject({
      summaryStrategy: "signature-only",
      summarySources: {
        signature: 5,
      },
    });
  });

  it("respects .gitignore entries during indexing", async () => {
    const repoRoot = await createFixtureRepo({ includeIgnoredFile: true });

    const summary = await indexFolder({ repoRoot });
    const fileTree = await getFileTree({ repoRoot });

    expect(summary.indexedFiles).toBe(2);
    expect(fileTree.map((file) => file.path)).not.toContain("src/ignored.ts");
  });

  it("indexes .mjs files as JavaScript source", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "hook.mjs"),
      `import { formatLabel } from "./strings.js";

export function hookLabel(value) {
  return formatLabel(value);
}
`,
    );

    const summary = await indexFolder({ repoRoot });
    const fileTree = await getFileTree({ repoRoot });
    const fileOutline = await getFileOutline({
      repoRoot,
      filePath: "src/hook.mjs",
    });

    expect(summary.indexedFiles).toBe(3);
    expect(fileTree.map((file) => file.path)).toContain("src/hook.mjs");
    expect(fileOutline).toMatchObject({
      filePath: "src/hook.mjs",
    });
    expect(fileOutline.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "hookLabel",
          kind: "function",
        }),
      ]),
    );
  });

  it("indexes .cjs files as JavaScript source", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "legacy.cjs"),
      `const { formatLabel } = require("./strings.js");

function legacyLabel(value) {
  return formatLabel(value);
}

module.exports = {
  legacyLabel,
};
`,
    );

    const summary = await indexFolder({ repoRoot });
    const fileTree = await getFileTree({ repoRoot });
    const fileOutline = await getFileOutline({
      repoRoot,
      filePath: "src/legacy.cjs",
    });

    expect(summary.indexedFiles).toBe(3);
    expect(fileTree.map((file) => file.path)).toContain("src/legacy.cjs");
    expect(fileOutline).toMatchObject({
      filePath: "src/legacy.cjs",
    });
    expect(fileOutline.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "legacyLabel",
          kind: "function",
        }),
      ]),
    );
  });

  it("anchors indexing and diagnostics to the enclosing git worktree root", async () => {
    const repoRoot = await createFixtureRepo();
    const canonicalRepoRoot = await realpath(repoRoot);
    const nestedRepoRoot = path.join(repoRoot, "src");

    const summary = await indexFolder({ repoRoot: nestedRepoRoot });
    const repoOutline = await getRepoOutline({ repoRoot: nestedRepoRoot });
    const health = await diagnostics({ repoRoot: nestedRepoRoot });

    expect(summary).toMatchObject({
      indexedFiles: 2,
      indexedSymbols: 5,
      staleStatus: "fresh",
    });
    expect(repoOutline).toMatchObject({
      totalFiles: 2,
      totalSymbols: 5,
    });
    expect(health.storageDir).toBe(
      path.join(canonicalRepoRoot, ".astrograph"),
    );
    expect(health.databasePath).toBe(
      path.join(canonicalRepoRoot, ".astrograph", "index.sqlite"),
    );
    expect(health.storageVersion).toBe(1);
    expect(health.schemaVersion).toBe(4);
  });

  it("migrates legacy Astrograph schema state before serving diagnostics", async () => {
    const repoRoot = await createFixtureRepo();
    const paths = resolveEnginePaths(repoRoot);

    await import("node:fs/promises").then((fs) =>
      fs.mkdir(paths.storageDir, { recursive: true }),
    );

    const legacyDb = new Database(paths.databasePath);
    legacyDb.exec(`
      CREATE TABLE meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        language TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        symbol_count INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    legacyDb.close();

    const health = await diagnostics({ repoRoot });
    expect(health.schemaVersion).toBe(4);

    const migratedDb = new Database(paths.databasePath, { readonly: true });
    const fileColumns = migratedDb
      .prepare("PRAGMA table_info(files)")
      .all() as Array<{ name: string }>;
    const dependencyTable = migratedDb
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'file_dependencies'")
      .get() as { name: string } | undefined;
    const schemaVersionRow = migratedDb
      .prepare("SELECT value FROM meta WHERE key = 'schemaVersion'")
      .get() as { value: string } | undefined;
    migratedDb.close();

    expect(fileColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "size_bytes",
        "mtime_ms",
        "integrity_hash",
        "symbol_signature_hash",
        "import_hash",
      ]),
    );
    expect(dependencyTable?.name).toBe("file_dependencies");
    expect(schemaVersionRow?.value).toBe("4");
  });

  it("supports symbol and text search plus exact retrieval", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    const symbolMatches = await searchSymbols({
      repoRoot,
      query: "area",
    });

    expect(symbolMatches[0]).toMatchObject({
      name: "area",
      filePath: "src/math.ts",
      exported: true,
    });

    const symbolSource = await getSymbolSource({
      repoRoot,
      symbolId: symbolMatches[0].id,
      verify: true,
    });
    expect(symbolSource.source).toContain("export function area");
    expect(symbolSource.source).toContain("formatLabel(value)");

    const fileContent = await getFileContent({
      repoRoot,
      filePath: "src/math.ts",
    });
    expect(fileContent.content).toContain("export const PI");

    const textMatches = await searchText({
      repoRoot,
      query: "Hello",
    });
    expect(textMatches[0]).toMatchObject({
      filePath: "src/strings.ts",
    });
  });

  it("falls back to live-disk text search when the index is missing", async () => {
    const repoRoot = await createFixtureRepo();

    const textMatches = await searchText({
      repoRoot,
      query: "Hello",
    });

    expect(textMatches[0]).toMatchObject({
      filePath: "src/strings.ts",
      source: "live_disk_match",
      reason: "ripgrep_fallback",
    });

    const discoverResult = await queryCode({
      repoRoot,
      intent: "discover",
      query: "Hello",
      includeTextMatches: true,
    });

    expect(discoverResult.intent).toBe("discover");
    if (discoverResult.intent !== "discover") {
      throw new Error("Expected discover result");
    }
    expect(discoverResult.symbolMatches).toEqual([]);
    expect(discoverResult.textMatches[0]).toMatchObject({
      filePath: "src/strings.ts",
      source: "live_disk_match",
      reason: "ripgrep_fallback",
    });
    expect(discoverResult.textMatchResults[0]).toMatchObject({
      reasons: ["ripgrep_fallback"],
    });
  });

  it("falls back to live-disk text search when index metadata is stale", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    const paths = resolveEnginePaths(repoRoot);
    await writeFile(
      paths.repoMetaPath,
      `${JSON.stringify({
        repoRoot,
        storageVersion: 1,
        indexedAt: new Date().toISOString(),
        indexedFiles: 2,
        indexedSymbols: 5,
        indexedSnapshotHash: "stale",
        storageMode: "wal",
        storageBackend: "sqlite",
        staleStatus: "stale",
        summaryStrategy: "doc-comments-first",
        watch: {
          status: "idle",
          backend: null,
          debounceMs: null,
          pollMs: null,
          startedAt: null,
          lastEvent: null,
          lastEventAt: null,
          lastChangedPaths: [],
          reindexCount: 0,
          lastError: null,
          lastSummary: null,
        },
      }, null, 2)}\n`,
    );

    await writeFile(
      path.join(repoRoot, "src", "strings.ts"),
      `// Format an area label for display.
export function formatLabel(value: number): string {
  return \`Area: \${value.toFixed(2)}\`;
}

/** Friendly greeter for string output. */
export class Greeter {
  // Return a greeting for the provided name.
  greet(name: string): string {
    return "Bonjour " + name;
  }
}
`,
    );

    const textMatches = await searchText({
      repoRoot,
      query: "Bonjour",
    });

    expect(textMatches[0]).toMatchObject({
      filePath: "src/strings.ts",
      source: "live_disk_match",
      reason: "ripgrep_fallback",
    });
  });

  it("applies repo-config live search limits during ripgrep fallback", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        limits: {
          maxLiveSearchMatches: 1,
        },
      }),
    );

    await writeFile(
      path.join(repoRoot, "src", "many.ts"),
      Array.from({ length: 5 }, () => "export const repeated = 'hello';").join("\n"),
    );

    const textMatches = await searchText({
      repoRoot,
      query: "hello",
    });

    expect(textMatches).toHaveLength(1);
    expect(textMatches[0]).toMatchObject({
      filePath: "src/many.ts",
      source: "live_disk_match",
      reason: "ripgrep_fallback",
    });
  });

  it("applies repo-config result limits to indexed symbol and text retrieval", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        limits: {
          maxSymbolResults: 1,
          maxTextResults: 2,
        },
      }),
    );

    await writeFile(
      path.join(repoRoot, "src", "greeter-utils.ts"),
      `export function greetAgain(name: string): string {
  return "Hello again " + name;
}
`,
    );

    await writeFile(
      path.join(repoRoot, "src", "many.ts"),
      [
        "export const first = 'hello';",
        "export const second = 'hello';",
        "export const third = 'hello';",
      ].join("\n"),
    );

    await indexFolder({ repoRoot });

    const symbolMatches = await searchSymbols({
      repoRoot,
      query: "greet",
      limit: 5,
    });
    expect(symbolMatches).toHaveLength(1);

    const textMatches = await searchText({
      repoRoot,
      query: "hello",
    });
    expect(textMatches).toHaveLength(2);

    const discoverResult = await queryCode({
      repoRoot,
      query: "hello",
      includeTextMatches: true,
    });

    expect(discoverResult.intent).toBe("discover");
    if (discoverResult.intent !== "discover") {
      throw new Error("Expected discover result");
    }
    expect(discoverResult.textMatches).toHaveLength(2);
  });

  it("skips oversized files during indexed discovery when maxFileBytes is configured", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        limits: {
          maxFileBytes: 512,
        },
      }),
    );

    await writeFile(
      path.join(repoRoot, "src", "large.ts"),
      `export const large = "${"x".repeat(2048)}";\n`,
    );

    const summary = await indexFolder({ repoRoot });
    expect(summary.indexedFiles).toBe(2);

    const outline = await getRepoOutline({ repoRoot });
    expect(outline.totalFiles).toBe(2);

    const fileTree = await getFileTree({ repoRoot });
    expect(fileTree.map((entry) => entry.path)).not.toContain("src/large.ts");
  });

  it("skips symbol-heavy files during indexed discovery when maxSymbolsPerFile is configured", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        limits: {
          maxSymbolsPerFile: 3,
        },
      }),
    );

    await writeFile(
      path.join(repoRoot, "src", "crowded.ts"),
      `export const one = 1;
export const two = 2;
export const three = 3;
export const four = 4;
`,
    );

    const summary = await indexFolder({ repoRoot });
    expect(summary).toMatchObject({
      indexedFiles: 2,
      staleStatus: "fresh",
    });

    const fileTree = await getFileTree({ repoRoot });
    expect(fileTree.map((entry) => entry.path)).not.toContain("src/crowded.ts");
  });

  it("applies repo-config include and exclude globs during indexed discovery", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        performance: {
          include: ["src/**/*.ts"],
          exclude: ["src/math.ts"],
        },
      }),
    );

    const summary = await indexFolder({ repoRoot });
    expect(summary).toMatchObject({
      indexedFiles: 1,
      indexedSymbols: 3,
      staleStatus: "fresh",
    });

    const fileTree = await getFileTree({ repoRoot });
    expect(fileTree.map((entry) => entry.path)).toEqual(["src/strings.ts"]);
  });

  it("stores routine fingerprint hashes separately from integrity content hashes", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    const paths = resolveEnginePaths(repoRoot);
    const db = new Database(paths.databasePath, { readonly: true });
    const rows = db
      .prepare(
        `
          SELECT path, content_hash, integrity_hash, symbol_signature_hash, import_hash
          FROM files
          ORDER BY path ASC
        `,
      )
      .all() as Array<{
      path: string;
      content_hash: string;
      integrity_hash: string | null;
      symbol_signature_hash: string | null;
      import_hash: string | null;
    }>;
    db.close();

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => /^xxh64:[0-9a-f]{16}$/u.test(row.content_hash))).toBe(true);
    expect(rows.every((row) => /^sha256:[0-9a-f]{64}$/u.test(row.integrity_hash ?? ""))).toBe(
      true,
    );
    expect(
      rows.every((row) => /^xxh64:[0-9a-f]{16}$/u.test(row.symbol_signature_hash ?? "")),
    ).toBe(true);
    expect(rows.every((row) => /^xxh64:[0-9a-f]{16}$/u.test(row.import_hash ?? ""))).toBe(
      true,
    );
  });

  it("produces deterministic index output across file processing concurrency settings", async () => {
    const serialRepoRoot = await createFixtureRepo();
    const parallelRepoRoot = await createFixtureRepo();
    const generatedModules = Array.from({ length: 12 }, (_, index) => ({
      relativePath: path.join("src", `generated-${index}.ts`),
      content: `import { formatLabel } from "./strings.js";

export function generated${index}(value: number): string {
  return formatLabel(value + ${index});
}
`,
    }));

    for (const repoRoot of [serialRepoRoot, parallelRepoRoot]) {
      await Promise.all(generatedModules.map((module) =>
        writeFile(path.join(repoRoot, module.relativePath), module.content),
      ));
    }

    await writeFile(
      path.join(serialRepoRoot, "astrograph.config.json"),
      JSON.stringify({
        performance: {
          fileProcessingConcurrency: 1,
        },
      }),
    );
    await writeFile(
      path.join(parallelRepoRoot, "astrograph.config.json"),
      JSON.stringify({
        performance: {
          fileProcessingConcurrency: 4,
        },
      }),
    );

    const [serialSummary, parallelSummary] = await Promise.all([
      indexFolder({ repoRoot: serialRepoRoot }),
      indexFolder({ repoRoot: parallelRepoRoot }),
    ]);

    expect(parallelSummary).toEqual(serialSummary);
    expect(await getRepoOutline({ repoRoot: parallelRepoRoot })).toEqual(
      await getRepoOutline({ repoRoot: serialRepoRoot }),
    );
    expect(await getFileTree({ repoRoot: parallelRepoRoot })).toEqual(
      await getFileTree({ repoRoot: serialRepoRoot }),
    );
    expect(snapshotIndexedRows(parallelRepoRoot)).toEqual(
      snapshotIndexedRows(serialRepoRoot),
    );
  });

  it("produces equivalent index output with and without the worker pool enabled", async () => {
    const directRepoRoot = await createFixtureRepo();
    const workerRepoRoot = await createFixtureRepo();
    const generatedModules = Array.from({ length: 12 }, (_, index) => ({
      relativePath: path.join("src", `worker-generated-${index}.ts`),
      content: `import { formatLabel } from "./strings.js";

export function workerGenerated${index}(value: number): string {
  return formatLabel(value + ${index});
}
`,
    }));

    for (const repoRoot of [directRepoRoot, workerRepoRoot]) {
      await Promise.all(generatedModules.map((module) =>
        writeFile(path.join(repoRoot, module.relativePath), module.content),
      ));
    }

    await writeFile(
      path.join(directRepoRoot, "astrograph.config.json"),
      JSON.stringify({
        performance: {
          fileProcessingConcurrency: 4,
          workerPool: {
            enabled: false,
            maxWorkers: 1,
          },
        },
      }),
    );
    await writeFile(
      path.join(workerRepoRoot, "astrograph.config.json"),
      JSON.stringify({
        performance: {
          fileProcessingConcurrency: 4,
          workerPool: {
            enabled: true,
            maxWorkers: 2,
          },
        },
      }),
    );

    const [directSummary, workerSummary] = await Promise.all([
      indexFolder({ repoRoot: directRepoRoot }),
      indexFolder({ repoRoot: workerRepoRoot }),
    ]);

    expect(workerSummary).toEqual(directSummary);
    expect(await getRepoOutline({ repoRoot: workerRepoRoot })).toEqual(
      await getRepoOutline({ repoRoot: directRepoRoot }),
    );
    expect(await getFileTree({ repoRoot: workerRepoRoot })).toEqual(
      await getFileTree({ repoRoot: directRepoRoot }),
    );
    expect(snapshotIndexedRows(workerRepoRoot)).toEqual(
      snapshotIndexedRows(directRepoRoot),
    );
  });

  it("offers a unified query surface for discovery, source retrieval, and assembly", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    const discoverResult = await queryCode({
      repoRoot,
      intent: "discover",
      query: "Greeter",
      kind: "class",
      includeTextMatches: true,
      limit: 1,
    });
    expect(discoverResult).toMatchObject({
      intent: "discover",
      query: "Greeter",
    });
    expect(discoverResult.intent).toBe("discover");
    if (discoverResult.intent !== "discover") {
      throw new Error("Expected discover result");
    }
    expect(discoverResult.symbolMatches[0]).toMatchObject({
      name: "Greeter",
      kind: "class",
    });
    expect(discoverResult.textMatches[0]).toMatchObject({
      filePath: "src/strings.ts",
    });
    const greeterId = discoverResult.symbolMatches[0]?.id;
    expect(greeterId).toBeDefined();

    const sourceResult = await queryCode({
      repoRoot,
      intent: "source",
      symbolIds: [greeterId!],
      contextLines: 1,
      verify: true,
    });
    expect(sourceResult).toMatchObject({
      intent: "source",
      fileContent: null,
      symbolSource: {
        requestedContextLines: 1,
      },
    });
    expect(sourceResult.intent).toBe("source");
    if (sourceResult.intent !== "source") {
      throw new Error("Expected source result");
    }
    expect(sourceResult.symbolSource?.items[0]?.symbol.name).toBe("Greeter");

    const assembleResult = await queryCode({
      repoRoot,
      intent: "assemble",
      query: "Greeter",
      tokenBudget: 120,
      includeRankedCandidates: true,
    });
    expect(assembleResult).toMatchObject({
      intent: "assemble",
      bundle: {
        tokenBudget: 120,
      },
      ranked: {
        query: "Greeter",
      },
    });
    expect(assembleResult.intent).toBe("assemble");
  });

  it("supports auto query mode when the intent is omitted", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    const discoverResult = await queryCode({
      repoRoot,
      query: "Greeter",
      includeTextMatches: true,
    });
    expect(discoverResult.intent).toBe("discover");
    if (discoverResult.intent !== "discover") {
      throw new Error("Expected discover result");
    }

    const greeterId = discoverResult.symbolMatches[0]?.id;
    expect(greeterId).toBeDefined();

    const sourceResult = await queryCode({
      repoRoot,
      symbolIds: [greeterId!],
      contextLines: 1,
    });
    expect(sourceResult.intent).toBe("source");

    const assembleResult = await queryCode({
      repoRoot,
      query: "Greeter",
      tokenBudget: 120,
    });
    expect(assembleResult.intent).toBe("assemble");
  });

  it("explains graph-aware discover results with dependency and importer reasons", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    const dependencyResult = await queryCode({
      repoRoot,
      intent: "discover",
      query: "area",
      includeDependencies: true,
      relationDepth: 1,
    });
    expect(dependencyResult.intent).toBe("discover");
    if (dependencyResult.intent !== "discover") {
      throw new Error("Expected discover result");
    }
    expect(dependencyResult.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: expect.objectContaining({
            name: "area",
          }),
          reasons: ["exact_symbol_match"],
          depth: 0,
        }),
        expect.objectContaining({
          symbol: expect.objectContaining({
            name: "formatLabel",
          }),
          reasons: expect.arrayContaining(["imports_matched_file"]),
        }),
      ]),
    );

    const importerResult = await queryCode({
      repoRoot,
      intent: "discover",
      query: "formatLabel",
      includeImporters: true,
      relationDepth: 1,
    });
    expect(importerResult.intent).toBe("discover");
    if (importerResult.intent !== "discover") {
      throw new Error("Expected discover result");
    }
    expect(importerResult.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: expect.objectContaining({
            name: "formatLabel",
          }),
          reasons: ["exact_symbol_match"],
          depth: 0,
        }),
        expect.objectContaining({
          symbol: expect.objectContaining({
            name: "area",
          }),
          reasons: expect.arrayContaining(["imported_by_match"]),
        }),
      ]),
    );
  });

  it("expands graph-aware results through exact symbol references without broad importer spillover", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "formatters.ts"),
      `export function firstFormatter(value: number): string {
  return value.toFixed(1);
}

export function bestFormatter(value: number): string {
  return value.toFixed(2);
}
`,
    );
    await writeFile(
      path.join(repoRoot, "src", "best-consumer.ts"),
      `import { bestFormatter } from "./formatters.js";

export function renderBest(value: number): string {
  return bestFormatter(value);
}
`,
    );
    await writeFile(
      path.join(repoRoot, "src", "first-consumer.ts"),
      `import { firstFormatter } from "./formatters.js";

export function renderFirst(value: number): string {
  return firstFormatter(value);
}
`,
    );

    await indexFolder({ repoRoot });

    const discoverResult = await queryCode({
      repoRoot,
      intent: "discover",
      query: "bestFormatter",
      includeDependencies: false,
      includeReferences: true,
      relationDepth: 1,
    });
    expect(discoverResult.intent).toBe("discover");
    if (discoverResult.intent !== "discover") {
      throw new Error("Expected discover result");
    }
    expect(discoverResult.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: expect.objectContaining({
            name: "bestFormatter",
          }),
          reasons: expect.arrayContaining(["exact_symbol_match"]),
        }),
        expect.objectContaining({
          symbol: expect.objectContaining({
            name: "renderBest",
          }),
          reasons: expect.arrayContaining(["references_match"]),
        }),
      ]),
    );
    expect(
      discoverResult.matches.some((entry) => entry.symbol.name === "renderFirst"),
    ).toBe(false);

    const bundle = await getContextBundle({
      repoRoot,
      query: "bestFormatter",
      includeDependencies: false,
      includeReferences: true,
      relationDepth: 1,
      tokenBudget: 220,
    });
    expect(bundle.items.some((item) => item.symbol.name === "renderBest")).toBe(true);
    expect(bundle.items.some((item) => item.symbol.name === "renderFirst")).toBe(false);
  });

  it("expands assembled query context with bounded graph relations", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    const assembleResult = await queryCode({
      repoRoot,
      intent: "assemble",
      query: "formatLabel",
      tokenBudget: 160,
      includeDependencies: true,
      includeImporters: true,
      relationDepth: 1,
      includeRankedCandidates: true,
    });

    expect(assembleResult.intent).toBe("assemble");
    if (assembleResult.intent !== "assemble") {
      throw new Error("Expected assemble result");
    }

    expect(assembleResult.bundle.usedTokens).toBeLessThanOrEqual(
      assembleResult.bundle.tokenBudget,
    );
    expect(assembleResult.bundle.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "target",
          symbol: expect.objectContaining({
            name: "formatLabel",
          }),
          reason: "exact_symbol_match",
        }),
        expect.objectContaining({
          role: expect.stringMatching(/target|dependency/),
          symbol: expect.objectContaining({
            name: "area",
          }),
          reason: expect.stringMatching(/query_match|imported_by_match/),
        }),
      ]),
    );
    expect(assembleResult.ranked?.candidates[0]).toMatchObject({
      reason: "exact_symbol_match",
      symbol: {
        name: "formatLabel",
      },
    });
  });

  it("deduplicates repeated import sources while rebuilding file dependencies", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "duplicate-imports.ts"),
      `import { area } from "./math.js";
import { PI } from "./math.js";

export function circleArea(radius: number): number {
  return area(radius) * PI;
}
`,
    );

    await indexFolder({ repoRoot });

    const paths = resolveEnginePaths(repoRoot);
    const db = new Database(paths.databasePath, { readonly: true });
    const rows = db.prepare(
      `
        SELECT importer_path, target_path, source
        FROM file_dependencies
        WHERE importer_path = ?
        ORDER BY target_path ASC, source ASC
      `,
    ).all("src/duplicate-imports.ts");
    db.close();

    expect(rows).toEqual([
      {
        importer_path: "src/duplicate-imports.ts",
        target_path: "src/math.ts",
        source: "./math.js",
      },
    ]);
  });

  it("rejects invalid search and retrieval boundaries at the library layer", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    await expect(
      searchSymbols({
        repoRoot,
        query: "Greeter",
        limit: 0,
      }),
    ).rejects.toThrow(/limit must be positive/i);

    await expect(
      getContextBundle({
        repoRoot,
        query: "Greeter",
        tokenBudget: 0,
      }),
    ).rejects.toThrow(/tokenBudget must be positive/i);

    await expect(
      getRankedContext({
        repoRoot,
        query: "Greeter",
        tokenBudget: 0,
      }),
    ).rejects.toThrow(/tokenBudget must be positive/i);

    await expect(
      getSymbolSource({
        repoRoot,
        contextLines: -1,
        symbolIds: ["src/strings.ts::Greeter"],
      }),
    ).rejects.toThrow(/contextLines must be non-negative/i);

    await expect(
      getContextBundle({
        repoRoot,
        query: "   ",
        symbolIds: ["   "],
      }),
    ).rejects.toThrow(/getContextBundle requires a non-empty query or symbolIds/i);
  });

  it("extracts symbols from a large file when single-pass tree-sitter parsing fails", async () => {
    const repoRoot = await createFixtureRepo();
    const largeModule = Array.from({ length: 900 }, (_, index) =>
      `export function helper${index}(value: number): number { return value + ${index}; }`,
    ).join("\n");

    await writeFile(path.join(repoRoot, "src", "large.ts"), `${largeModule}\n`);

    const summary = await indexFolder({ repoRoot });
    const fileTree = await getFileTree({ repoRoot });
    const largeOutline = await getFileOutline({
      repoRoot,
      filePath: "src/large.ts",
    });
    const largeContent = await getFileContent({
      repoRoot,
      filePath: "src/large.ts",
    });
    const textMatches = await searchText({
      repoRoot,
      query: "helper899",
      filePattern: "src/large.ts",
    });
    const symbolMatches = await searchSymbols({
      repoRoot,
      query: "helper899",
      filePattern: "src/large.ts",
    });

    expect(summary).toMatchObject({
      indexedFiles: 3,
      staleStatus: "fresh",
    });
    expect(fileTree).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/large.ts",
          symbolCount: 900,
        }),
      ]),
    );
    expect(largeOutline.filePath).toBe("src/large.ts");
    expect(largeOutline.symbols).toHaveLength(900);
    expect(largeOutline.symbols[0]).toMatchObject({
      name: "helper0",
    });
    expect(largeContent.content).toContain("helper899");
    expect(textMatches[0]).toMatchObject({
      filePath: "src/large.ts",
    });
    expect(symbolMatches[0]).toMatchObject({
      filePath: "src/large.ts",
      name: "helper899",
    });
  });

  it("indexes a declaration that spans chunk boundaries exactly once", async () => {
    const repoRoot = await createFixtureRepo();
    const filler = Array.from({ length: 220 }, (_, index) =>
      `export function filler${index}(value: number): number { return value + ${index}; }`,
    ).join("\n");
    const spanningFunction = [
      "export function boundaryHelper(value: number): string {",
      "  const parts = [",
      ...Array.from({ length: 180 }, (_, index) => `    "segment-${index}-${"x".repeat(48)}",`),
      "  ];",
      "  return parts.join(value.toString());",
      "}",
    ].join("\n");
    const suffix = Array.from({ length: 40 }, (_, index) =>
      `export const tail${index} = ${index};`,
    ).join("\n");

    await writeFile(
      path.join(repoRoot, "src", "boundary.ts"),
      `${filler}\n${spanningFunction}\n${suffix}\n`,
    );

    await indexFolder({ repoRoot });

    const fileOutline = await getFileOutline({
      repoRoot,
      filePath: "src/boundary.ts",
    });
    const boundarySymbols = fileOutline.symbols.filter(
      (symbol) => symbol.name === "boundaryHelper",
    );
    const symbolMatches = await searchSymbols({
      repoRoot,
      query: "boundaryHelper",
      filePattern: "src/boundary.ts",
    });

    expect(boundarySymbols).toHaveLength(1);
    expect(boundarySymbols[0]).toMatchObject({
      name: "boundaryHelper",
      kind: "function",
      filePath: "src/boundary.ts",
    });
    expect(
      symbolMatches.filter((symbol) => symbol.name === "boundaryHelper"),
    ).toHaveLength(1);
  });

  it("supports language and file pattern filters in search", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "widget.jsx"),
      `export function GreeterWidget() {
  return <div>Hello widget</div>;
}
`,
    );

    await indexFolder({ repoRoot });

    const tsMatches = await searchSymbols({
      repoRoot,
      query: "Greeter",
      language: "ts",
      filePattern: "src/*.ts",
    });
    expect(tsMatches.every((entry) => entry.filePath.endsWith(".ts"))).toBe(true);
    expect(tsMatches.some((entry) => entry.name === "Greeter")).toBe(true);
    expect(tsMatches.some((entry) => entry.filePath.endsWith(".jsx"))).toBe(false);

    const jsxMatches = await searchSymbols({
      repoRoot,
      query: "Greeter",
      language: "jsx",
      filePattern: "src/*.jsx",
    });
    expect(jsxMatches).toHaveLength(1);
    expect(jsxMatches[0]).toMatchObject({
      name: "GreeterWidget",
      filePath: "src/widget.jsx",
    });

    const textMatches = await searchText({
      repoRoot,
      query: "Hello",
      filePattern: "src/*.jsx",
    });
    expect(textMatches).toHaveLength(1);
    expect(textMatches[0]).toMatchObject({
      filePath: "src/widget.jsx",
    });
  });

  it("accepts windows-style file patterns in search filters", async () => {
    const repoRoot = await createFixtureRepo();
    await mkdir(path.join(repoRoot, "src", "nested"), { recursive: true });

    await writeFile(
      path.join(repoRoot, "src", "nested", "widget.ts"),
      `export function nestedWidget() {
  return "nested";
}
`,
    );

    await indexFolder({ repoRoot });

    const symbolMatches = await searchSymbols({
      repoRoot,
      query: "nestedWidget",
      filePattern: "src\\**\\*.ts",
    });
    const textMatches = await searchText({
      repoRoot,
      query: "nested",
      filePattern: "src\\**\\*.ts",
    });

    expect(symbolMatches).toEqual([
      expect.objectContaining({
        name: "nestedWidget",
        filePath: "src/nested/widget.ts",
      }),
    ]);
    expect(textMatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: "src/nested/widget.ts",
        }),
      ]),
    );
  });

  it("preserves substring search behavior when FTS shortlists are too narrow", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    const symbolMatches = await searchSymbols({
      repoRoot,
      query: "reet",
    });
    expect(symbolMatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Greeter",
          filePath: "src/strings.ts",
        }),
      ]),
    );

    const textMatches = await searchText({
      repoRoot,
      query: "ello",
    });
    expect(textMatches[0]).toMatchObject({
      filePath: "src/strings.ts",
    });
  });

  it("supports batch symbol source retrieval with optional context lines", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    const symbolMatches = await searchSymbols({
      repoRoot,
      query: "Greeter",
    });
    const greetMatches = await searchSymbols({
      repoRoot,
      query: "greet",
    });

    const symbolSource = await getSymbolSource({
      repoRoot,
      symbolIds: [symbolMatches[0].id, greetMatches[0].id],
      contextLines: 1,
      verify: true,
    });

    expect(symbolSource.requestedContextLines).toBe(1);
    expect(symbolSource.items).toHaveLength(2);
    expect(symbolSource.items[0]).toMatchObject({
      symbol: {
        name: "Greeter",
      },
      verified: true,
    });
    expect(symbolSource.items[0]?.source).toContain(
      "/** Friendly greeter for string output. */",
    );
    expect(symbolSource.items[1]).toMatchObject({
      symbol: {
        name: "greet",
      },
      verified: true,
    });
    expect(symbolSource.items[1]?.source).toContain(
      '// Return a greeting for the provided name.',
    );
  });

  it("assembles bounded context bundles from persisted indexed content", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    const bundle = await getContextBundle({
      repoRoot,
      query: "area",
      tokenBudget: 120,
    });

    expect(bundle.items[0]).toMatchObject({
      role: "target",
      symbol: {
        name: "area",
        filePath: "src/math.ts",
      },
    });
    expect(bundle.items.some((item) => item.symbol.name === "formatLabel")).toBe(
      true,
    );
    expect(bundle.items[0].source).toContain("return formatLabel(value);");
    expect(bundle.truncated).toBe(false);

    await writeFile(
      path.join(repoRoot, "src", "math.ts"),
      `import { formatLabel } from "./strings.js";

export const PI = 3.14;

export function area(radius: number): string {
  return "changed";
}
`,
    );

    const persistedBundle = await getContextBundle({
      repoRoot,
      query: "area",
      tokenBudget: 120,
    });

    expect(persistedBundle.items[0].source).toContain(
      "return formatLabel(value);",
    );
    expect(persistedBundle.items[0].source).not.toContain("changed");
  });

  it("keeps context bundles inside the declared token budget", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    const bundle = await getContextBundle({
      repoRoot,
      query: "area",
      tokenBudget: 10,
    });

    expect(bundle.usedTokens).toBeLessThanOrEqual(bundle.tokenBudget);
  });

  it("returns ranked query context with visible candidate selection", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    const rankedContext = await getRankedContext({
      repoRoot,
      query: "Greeter",
      tokenBudget: 120,
    });

    expect(rankedContext).toMatchObject({
      query: "Greeter",
      candidateCount: expect.any(Number),
      selectedSeedIds: expect.any(Array),
      bundle: {
        tokenBudget: 120,
      },
    });
    expect(rankedContext.candidates[0]).toMatchObject({
      rank: 1,
      reason: "exact_symbol_match",
      symbol: {
        name: "Greeter",
        filePath: "src/strings.ts",
      },
      selected: true,
    });
    expect(rankedContext.selectedSeedIds).toContain(
      rankedContext.candidates[0]?.symbol.id,
    );
    expect(rankedContext.bundle.items[0]).toMatchObject({
      role: "target",
      symbol: {
        name: "Greeter",
      },
    });
  });

  it("resolves aliased named imports to the correct dependency symbol", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "formatters.ts"),
      `export function firstFormatter(value: number): string {
  return value.toFixed(1);
}

export function bestFormatter(value: number): string {
  return value.toFixed(2);
}
`,
    );
    await writeFile(
      path.join(repoRoot, "src", "consumer.ts"),
      `import { bestFormatter as format } from "./formatters.js";

export function renderValue(value: number): string {
  return format(value);
}
`,
    );

    await indexFolder({ repoRoot });

    const bundle = await getContextBundle({
      repoRoot,
      query: "renderValue",
      tokenBudget: 200,
    });

    expect(bundle.items.some((item) => item.symbol.name === "bestFormatter")).toBe(
      true,
    );
    expect(bundle.items.some((item) => item.symbol.name === "firstFormatter")).toBe(
      false,
    );
  });

  it("refreshes dependency edges when an importer changes its imported symbol", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "formatters.ts"),
      `export function firstFormatter(value: number): string {
  return value.toFixed(1);
}

export function bestFormatter(value: number): string {
  return value.toFixed(2);
}
`,
    );
    await writeFile(
      path.join(repoRoot, "src", "consumer.ts"),
      `import { bestFormatter as format } from "./formatters.js";

export function renderValue(value: number): string {
  return format(value);
}
`,
    );

    await indexFolder({ repoRoot });

    const initialBundle = await getContextBundle({
      repoRoot,
      query: "renderValue",
      tokenBudget: 200,
    });
    expect(initialBundle.items.some((item) => item.symbol.name === "bestFormatter")).toBe(
      true,
    );

    await writeFile(
      path.join(repoRoot, "src", "consumer.ts"),
      `import { firstFormatter as format } from "./formatters.js";

export function renderValue(value: number): string {
  return format(value);
}
`,
    );

    const refresh = await indexFile({
      repoRoot,
      filePath: "src/consumer.ts",
    });
    expect(refresh).toMatchObject({
      indexedFiles: 1,
      staleStatus: "fresh",
    });

    const updatedBundle = await getContextBundle({
      repoRoot,
      query: "renderValue",
      tokenBudget: 200,
    });
    expect(updatedBundle.items.some((item) => item.symbol.name === "firstFormatter")).toBe(
      true,
    );
    expect(updatedBundle.items.some((item) => item.symbol.name === "bestFormatter")).toBe(
      false,
    );
  });

  it("re-evaluates direct importers when an exporter changes during single-file refresh", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "formatters.ts"),
      `export function bestFormatter(value: number): string {
  return value.toFixed(2);
}
`,
    );
    await writeFile(
      path.join(repoRoot, "src", "consumer.ts"),
      `import { bestFormatter } from "./formatters.js";

export function renderValue(value: number): string {
  return bestFormatter(value);
}
`,
    );

    await indexFolder({ repoRoot });

    const initialImporterUpdatedAt = readIndexedFileUpdatedAt(repoRoot, "src/consumer.ts");
    expect(initialImporterUpdatedAt).not.toBeNull();

    await delay(20);
    await writeFile(
      path.join(repoRoot, "src", "formatters.ts"),
      `export function bestFormatter(value: number): string {
  return \`value=\${value.toFixed(2)}\`;
}
`,
    );

    const refresh = await indexFile({
      repoRoot,
      filePath: "src/formatters.ts",
    });

    expect(refresh).toMatchObject({
      indexedFiles: 2,
      staleStatus: "fresh",
    });

    const importerUpdatedAt = readIndexedFileUpdatedAt(repoRoot, "src/consumer.ts");
    expect(importerUpdatedAt).not.toBe(initialImporterUpdatedAt);
  });

  it("doctor surfaces unresolved relative imports and affected importers", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "broken-consumer.ts"),
      `import { missingValue } from "./missing.js";

export function renderBroken(): string {
  return String(missingValue);
}
`,
    );

    await indexFolder({ repoRoot });

    const result = await doctor({ repoRoot });

    expect(result.dependencyGraph).toMatchObject({
      brokenRelativeImportCount: 1,
      affectedImporterCount: 1,
      sampleImporterPaths: ["src/broken-consumer.ts"],
    });
    expect(result.warnings).toContain(
      "Dependency graph contains 1 unresolved relative import(s) across 1 importer file(s).",
    );
    expect(
      result.suggestedActions.some((entry) =>
        entry.includes("src/broken-consumer.ts"),
      ),
    ).toBe(true);
  });

  it("doctor and diagnostics report unresolved relative symbol imports", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "formatters.ts"),
      `export function firstFormatter(value: number): string {
  return value.toFixed(1);
}
`,
    );
    await writeFile(
      path.join(repoRoot, "src", "consumer.ts"),
      `import { bestFormatter } from "./formatters.js";

export function renderValue(value: number): string {
  return bestFormatter(value);
}
`,
    );

    await indexFolder({ repoRoot });

    const doctorResult = await doctor({ repoRoot });
    expect(doctorResult.dependencyGraph).toMatchObject({
      brokenRelativeImportCount: 0,
      brokenRelativeSymbolImportCount: 1,
      affectedImporterCount: 1,
      sampleImporterPaths: ["src/consumer.ts"],
    });
    expect(doctorResult.warnings).toContain(
      "Dependency graph contains 1 unresolved relative symbol import(s).",
    );
    expect(
      doctorResult.suggestedActions.some((entry) =>
        entry.includes("src/consumer.ts")
      ),
    ).toBe(true);

    const health = await diagnostics({ repoRoot });
    expect(health.dependencyGraph).toMatchObject({
      brokenRelativeImportCount: 0,
      brokenRelativeSymbolImportCount: 1,
      affectedImporterCount: 1,
      sampleImporterPaths: ["src/consumer.ts"],
    });
    expect(health.staleStatus).toBe("stale");
    expect(health.staleReasons).toContain("unresolved relative symbol imports");
  });

  it("doctor warns on obvious secret-like indexed source content without marking the index stale", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "secrets.ts"),
      `export const leakedKey = "sk-abcdefghijklmnopqrstuvwxyz123456";
`,
    );

    await indexFolder({ repoRoot });

    const result = await doctor({ repoRoot });

    expect(result.privacy).toMatchObject({
      secretLikeFileCount: 1,
      sampleFilePaths: ["src/secrets.ts"],
    });
    expect(result.warnings).toContain(
      "Indexed source contains 1 file(s) with obvious secret-like content.",
    );
    expect(
      result.suggestedActions.some((entry) =>
        entry.includes("src/secrets.ts"),
      ),
    ).toBe(true);
    expect(result.indexStatus).toBe("indexed");
    expect(result.freshness.status).toBe("fresh");
  });

  it("uses repo-config storage mode in diagnostics and doctor output", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        storageMode: "wal",
      }),
    );

    await indexFolder({ repoRoot });

    const health = await diagnostics({ repoRoot });
    expect(health.storageMode).toBe("wal");

    const result = await doctor({ repoRoot });
    expect(result.storageMode).toBe("wal");
  });

  it("applies repo-config ranking weights to symbol search and ranked context", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        ranking: {
          exactName: 0,
          exactQualifiedName: 0,
          prefixName: 0,
          prefixQualifiedName: 0,
          containsName: 0,
          containsQualifiedName: 0,
          signatureContains: 0,
          summaryContains: 2000,
          filePathContains: 0,
          exactWord: 0,
          tokenMatch: 0,
          exportedBonus: 0,
        },
      }),
    );

    await writeFile(
      path.join(repoRoot, "src", "area-helper.ts"),
      `/** Radius helper for area-related output. */
export function helperValue(): string {
  return "helper";
}
`,
    );

    await indexFolder({ repoRoot });

    const symbolMatches = await searchSymbols({
      repoRoot,
      query: "radius",
    });
    expect(symbolMatches[0]).toMatchObject({
      name: "helperValue",
      filePath: "src/area-helper.ts",
    });

    const rankedContext = await getRankedContext({
      repoRoot,
      query: "radius",
      tokenBudget: 120,
    });
    expect(rankedContext.candidates[0]).toMatchObject({
      reason: "query_match",
      symbol: {
        name: "helperValue",
        filePath: "src/area-helper.ts",
      },
    });
  });

  it("reports corrupted index metadata and suggests a rebuild", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    const paths = resolveEnginePaths(repoRoot);
    const meta = JSON.parse(
      await import("node:fs/promises").then((fs) =>
        fs.readFile(paths.repoMetaPath, "utf8")
      ),
    ) as Record<string, unknown>;

    await writeFile(
      paths.repoMetaPath,
      `${JSON.stringify({
        ...meta,
        indexedFiles: 999,
      }, null, 2)}\n`,
    );

    const health = await diagnostics({ repoRoot });
    expect(health.staleStatus).toBe("stale");
    expect(health.staleReasons).toContain("index metadata integrity mismatch");

    const result = await doctor({ repoRoot });
    expect(result.warnings).toContain("Index metadata integrity check failed.");
    expect(
      result.suggestedActions.some((entry) =>
        entry.includes("index-folder"),
      ),
    ).toBe(true);
  });

  it("diagnostics marks unresolved relative imports as stale dependency drift", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "broken-consumer.ts"),
      `import { missingValue } from "./missing.js";

export function renderBroken(): string {
  return String(missingValue);
}
`,
    );

    await indexFolder({ repoRoot });

    const health = await diagnostics({ repoRoot });

    expect(health.dependencyGraph).toMatchObject({
      brokenRelativeImportCount: 1,
      affectedImporterCount: 1,
      sampleImporterPaths: ["src/broken-consumer.ts"],
    });
    expect(health.staleStatus).toBe("stale");
    expect(health.staleReasons).toContain("unresolved relative imports");
  });

  it("can refresh a single file without a full rebuild", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    await writeFile(
      path.join(repoRoot, "src", "math.ts"),
      `import { formatLabel } from "./strings.js";

export const PI = 3.14;

export function circumference(radius: number): string {
  return formatLabel(2 * PI * radius);
}
`,
    );

    const update = await indexFile({
      repoRoot,
      filePath: "src/math.ts",
    });

    expect(update).toMatchObject({
      indexedFiles: 1,
      indexedSymbols: 2,
      staleStatus: "fresh",
    });

    const symbolMatches = await searchSymbols({
      repoRoot,
      query: "circumference",
    });
    expect(symbolMatches[0]?.name).toBe("circumference");

    const health = await diagnostics({ repoRoot });
    expect(health.storageMode).toBe("wal");
    expect(health.storageBackend).toBe("sqlite");
    expect(health.staleStatus).toBe("fresh");
    expect(health).toMatchObject({
      freshnessMode: "metadata",
      freshnessScanned: false,
    });
  });

  it("removes existing indexed rows when single-file refresh exceeds maxSymbolsPerFile", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        limits: {
          maxSymbolsPerFile: 3,
        },
      }),
    );

    await indexFolder({ repoRoot });

    await writeFile(
      path.join(repoRoot, "src", "math.ts"),
      `export const PI = 3.14;
export const TAU = 6.28;
export function area(radius: number): number {
  return PI * radius * radius;
}
export function circumference(radius: number): number {
  return TAU * radius;
}
`,
    );

    const update = await indexFile({
      repoRoot,
      filePath: "src/math.ts",
    });

    expect(update).toMatchObject({
      indexedFiles: 0,
      indexedSymbols: 0,
      staleStatus: "fresh",
    });

    const fileTree = await getFileTree({ repoRoot });
    expect(fileTree.map((entry) => entry.path)).not.toContain("src/math.ts");
    expect(await searchSymbols({ repoRoot, query: "circumference" })).toHaveLength(0);
  });

  it("marks single-file refresh stale when an exporter change breaks downstream symbol imports", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "formatters.ts"),
      `export function bestFormatter(value: number): string {
  return value.toFixed(2);
}
`,
    );
    await writeFile(
      path.join(repoRoot, "src", "consumer.ts"),
      `import { bestFormatter } from "./formatters.js";

export function renderValue(value: number): string {
  return bestFormatter(value);
}
`,
    );

    await indexFolder({ repoRoot });

    await writeFile(
      path.join(repoRoot, "src", "formatters.ts"),
      `export function firstFormatter(value: number): string {
  return value.toFixed(1);
}
`,
    );

    const update = await indexFile({
      repoRoot,
      filePath: "src/formatters.ts",
    });

    expect(update).toMatchObject({
      indexedFiles: 2,
      indexedSymbols: 2,
      staleStatus: "stale",
    });

    const health = await diagnostics({ repoRoot });
    expect(health.staleStatus).toBe("stale");
    expect(health.staleReasons).toContain("unresolved relative symbol imports");
  });

  it("can refresh a single file with worker-pool analysis enabled", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        performance: {
          workerPool: {
            enabled: true,
            maxWorkers: 2,
          },
        },
      }),
    );

    await indexFolder({ repoRoot });

    await writeFile(
      path.join(repoRoot, "src", "math.ts"),
      `import { formatLabel } from "./strings.js";

export const PI = 3.14;

export function circumference(radius: number): string {
  return formatLabel(2 * PI * radius);
}
`,
    );

    const update = await indexFile({
      repoRoot,
      filePath: "src/math.ts",
    });

    expect(update).toMatchObject({
      indexedFiles: 1,
      indexedSymbols: 2,
      staleStatus: "fresh",
    });
    expect(
      (await searchSymbols({ repoRoot, query: "circumference" }))[0]?.name,
    ).toBe("circumference");
  });

  it("removes stale index entries when single-file refresh targets a deleted or renamed file", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    await writeFile(
      path.join(repoRoot, "src", "math-renamed.ts"),
      `import { formatLabel } from "./strings.js";

export function perimeter(radius: number): string {
  return formatLabel(2 * radius);
}
`,
    );
    await rm(path.join(repoRoot, "src", "math.ts"));

    const removed = await indexFile({
      repoRoot,
      filePath: "src/math.ts",
    });
    expect(removed).toMatchObject({
      indexedFiles: 1,
      indexedSymbols: 0,
      staleStatus: "fresh",
    });
    const fileTreeAfterRemoval = await getFileTree({ repoRoot });
    expect(fileTreeAfterRemoval.map((entry) => entry.path)).not.toContain(
      "src/math.ts",
    );

    const added = await indexFile({
      repoRoot,
      filePath: "src/math-renamed.ts",
    });
    expect(added).toMatchObject({
      indexedFiles: 1,
      indexedSymbols: 1,
      staleStatus: "fresh",
    });

    const perimeterMatches = await searchSymbols({
      repoRoot,
      query: "perimeter",
    });
    expect(perimeterMatches[0]).toMatchObject({
      name: "perimeter",
      filePath: "src/math-renamed.ts",
    });
  });

  it("supports debounced watch mode with changed-file fast refresh", async () => {
    const repoRoot = await createFixtureRepo();
    const reindexEvents: Array<{ changedPaths: string[]; summary?: { indexedFiles: number } }> = [];

    const watcher = await watchFolder({
      repoRoot,
      debounceMs: 50,
      onEvent(event) {
        if (event.type === "reindex") {
          reindexEvents.push({
            changedPaths: event.changedPaths,
            summary: event.summary
              ? {
                  indexedFiles: event.summary.indexedFiles,
                }
              : undefined,
          });
        }
      },
    });

    try {
      await writeFile(
        path.join(repoRoot, "src", "math.ts"),
        `import { formatLabel } from "./strings.js";

export const PI = 3.14;

export function circumference(radius: number): string {
  return formatLabel(2 * PI * radius);
}
`,
      );
      await writeFile(
        path.join(repoRoot, "src", "math.ts"),
        `import { formatLabel } from "./strings.js";

export const PI = 3.14;

export function circumference(radius: number): string {
  return formatLabel(2 * PI * radius + 1);
}
`,
      );

      await waitFor(() => reindexEvents.length >= 1, 4000);

      const symbolMatches = await searchSymbols({
        repoRoot,
        query: "circumference",
      });

      expect(symbolMatches[0]?.name).toBe("circumference");
      expect(reindexEvents).toHaveLength(1);
      expect(reindexEvents[0]?.changedPaths).toContain("src/math.ts");
      expect(reindexEvents[0]?.summary).toMatchObject({
        indexedFiles: 1,
      });

      const health = await diagnostics({ repoRoot });
      expect(health.watch).toMatchObject({
        status: "watching",
        backend: expect.stringMatching(/^(parcel|node-fs-watch|polling)$/u),
        debounceMs: 50,
        pollMs: 50,
        lastEvent: "reindex",
        lastChangedPaths: ["src/math.ts"],
        reindexCount: 1,
        lastError: null,
        lastSummary: {
          indexedFiles: 1,
          staleStatus: "fresh",
        },
      });
    } finally {
      await watcher.close();
    }

    const closedHealth = await diagnostics({ repoRoot });
    expect(closedHealth.watch).toMatchObject({
      status: "idle",
      backend: expect.stringMatching(/^(parcel|node-fs-watch|polling)$/u),
      lastEvent: "close",
    });
    expect(closedHealth.watch.reindexCount).toBeGreaterThanOrEqual(1);
  });

  it("uses repo-config watch defaults when explicit watch options are omitted", async () => {
    const repoRoot = await createFixtureRepo();
    const reindexEvents: Array<{ changedPaths: string[] }> = [];

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        watch: {
          backend: "polling",
          debounceMs: 75,
        },
      }),
    );

    const watcher = await watchFolder({
      repoRoot,
      onEvent(event) {
        if (event.type === "reindex") {
          reindexEvents.push({
            changedPaths: event.changedPaths,
          });
        }
      },
    });

    try {
      await writeFile(
        path.join(repoRoot, "src", "math.ts"),
        `import { formatLabel } from "./strings.js";

export const PI = 3.14;

export function circumference(radius: number): string {
  return formatLabel(2 * PI * radius);
}
`,
      );

      await waitFor(() => reindexEvents.length >= 1, 4000);

      const health = await diagnostics({ repoRoot });
      expect(health.watch).toMatchObject({
        status: "watching",
        backend: "polling",
        debounceMs: 75,
        pollMs: 75,
        lastEvent: "reindex",
        lastChangedPaths: ["src/math.ts"],
      });
    } finally {
      await watcher.close();
    }
  });

  it("supports watch refresh with worker-pool analysis enabled", async () => {
    const repoRoot = await createFixtureRepo();
    const reindexEvents: Array<{ changedPaths: string[] }> = [];

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        watch: {
          backend: "polling",
          debounceMs: 75,
        },
        performance: {
          workerPool: {
            enabled: true,
            maxWorkers: 2,
          },
        },
      }),
    );

    const watcher = await watchFolder({
      repoRoot,
      onEvent(event) {
        if (event.type === "reindex") {
          reindexEvents.push({
            changedPaths: event.changedPaths,
          });
        }
      },
    });

    try {
      await writeFile(
        path.join(repoRoot, "src", "math.ts"),
        `import { formatLabel } from "./strings.js";

export const PI = 3.14;

export function circumference(radius: number): string {
  return formatLabel(2 * PI * radius + 1);
}
`,
      );

      await waitFor(() => reindexEvents.length >= 1, 4000);

      expect(
        (await searchSymbols({ repoRoot, query: "circumference" }))[0]?.name,
      ).toBe("circumference");
      const health = await diagnostics({ repoRoot });
      expect(health.watch).toMatchObject({
        status: "watching",
        backend: "polling",
        debounceMs: 75,
        pollMs: 75,
        lastEvent: "reindex",
        lastChangedPaths: ["src/math.ts"],
      });
    } finally {
      await watcher.close();
    }
  });

  it("reports stale watch refresh summaries when exporter changes break downstream symbol imports", async () => {
    const repoRoot = await createFixtureRepo();
    const reindexEvents: Array<{
      changedPaths: string[];
      indexedFiles?: number | undefined;
      staleStatus?: string | undefined;
    }> = [];

    await writeFile(
      path.join(repoRoot, "src", "formatters.ts"),
      `export function bestFormatter(value: number): string {
  return value.toFixed(2);
}
`,
    );
    await writeFile(
      path.join(repoRoot, "src", "consumer.ts"),
      `import { bestFormatter } from "./formatters.js";

export function renderValue(value: number): string {
  return bestFormatter(value);
}
`,
    );

    const watcher = await watchFolder({
      repoRoot,
      debounceMs: 50,
      onEvent(event) {
        if (event.type === "reindex") {
          reindexEvents.push({
            changedPaths: event.changedPaths,
            indexedFiles: event.summary?.indexedFiles,
            staleStatus: event.summary?.staleStatus,
          });
        }
      },
    });

    try {
      await writeFile(
        path.join(repoRoot, "src", "formatters.ts"),
        `export function firstFormatter(value: number): string {
  return value.toFixed(1);
}
`,
      );

      await waitFor(() => reindexEvents.length >= 1, 4000);

      expect(reindexEvents[0]).toMatchObject({
        changedPaths: ["src/formatters.ts"],
        indexedFiles: 2,
        staleStatus: "stale",
      });

      const health = await diagnostics({ repoRoot });
      expect(health.staleStatus).toBe("stale");
      expect(health.staleReasons).toContain("unresolved relative symbol imports");
      expect(health.watch.lastSummary?.staleStatus).toBe("stale");
    } finally {
      await watcher.close();
    }
  });

  it("re-evaluates direct importers during watch refresh when an exporter changes", async () => {
    const repoRoot = await createFixtureRepo();
    const reindexEvents: Array<{ changedPaths: string[]; indexedFiles?: number | undefined }> = [];

    await writeFile(
      path.join(repoRoot, "src", "formatters.ts"),
      `export function bestFormatter(value: number): string {
  return value.toFixed(2);
}
`,
    );
    await writeFile(
      path.join(repoRoot, "src", "consumer.ts"),
      `import { bestFormatter } from "./formatters.js";

export function renderValue(value: number): string {
  return bestFormatter(value);
}
`,
    );

    const watcher = await watchFolder({
      repoRoot,
      debounceMs: 50,
      onEvent(event) {
        if (event.type === "reindex") {
          reindexEvents.push({
            changedPaths: event.changedPaths,
            indexedFiles: event.summary?.indexedFiles,
          });
        }
      },
    });

    try {
      const initialImporterUpdatedAt = readIndexedFileUpdatedAt(repoRoot, "src/consumer.ts");
      expect(initialImporterUpdatedAt).not.toBeNull();

      await delay(20);
      await writeFile(
        path.join(repoRoot, "src", "formatters.ts"),
        `export function bestFormatter(value: number): string {
  return \`value=\${value.toFixed(2)}\`;
}
`,
      );

      await waitFor(() => reindexEvents.length >= 1, 4000);

      expect(reindexEvents[0]).toMatchObject({
        changedPaths: ["src/formatters.ts"],
        indexedFiles: 2,
      });
      expect(readIndexedFileUpdatedAt(repoRoot, "src/consumer.ts")).not.toBe(
        initialImporterUpdatedAt,
      );
    } finally {
      await watcher.close();
    }
  });

  it("removes deleted files during watch refresh without a full folder reindex", async () => {
    const repoRoot = await createFixtureRepo();
    const reindexEvents: Array<{ changedPaths: string[]; summary?: { indexedFiles: number } }> = [];

    const watcher = await watchFolder({
      repoRoot,
      debounceMs: 50,
      onEvent(event) {
        if (event.type === "reindex") {
          reindexEvents.push({
            changedPaths: event.changedPaths,
            summary: event.summary
              ? {
                  indexedFiles: event.summary.indexedFiles,
                }
              : undefined,
          });
        }
      },
    });

    try {
      await rm(path.join(repoRoot, "src", "math.ts"));

      await waitFor(() => reindexEvents.length >= 1, 4000);

      const symbolMatches = await searchSymbols({
        repoRoot,
        query: "PI",
      });
      const health = await diagnostics({ repoRoot });

      expect(symbolMatches).toHaveLength(0);
      expect(health).toMatchObject({
        indexedFiles: 1,
        currentFiles: 1,
        staleStatus: "fresh",
      });
      expect(reindexEvents).toHaveLength(1);
      expect(reindexEvents[0]?.changedPaths).toContain("src/math.ts");
      expect(reindexEvents[0]?.summary).toMatchObject({
        indexedFiles: 1,
      });
    } finally {
      await watcher.close();
    }
  });

  it("surfaces live freshness drift after the repository changes", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    const initialHealth = await diagnostics({ repoRoot, scanFreshness: true });
    expect(initialHealth).toMatchObject({
      staleStatus: "fresh",
      freshnessMode: "scan",
      freshnessScanned: true,
      indexedFiles: 2,
      currentFiles: 2,
      missingFiles: 0,
      changedFiles: 0,
      extraFiles: 0,
    });
    expect(initialHealth.indexedAt).not.toBeNull();
    expect(initialHealth.indexAgeMs).not.toBeNull();
    expect(initialHealth.currentSnapshotHash).toBe(initialHealth.indexedSnapshotHash);

    await writeFile(
      path.join(repoRoot, "src", "math.ts"),
      `import { formatLabel } from "./strings.js";

export const PI = 3.14;

export function area(radius: number): string {
  return "changed";
}
`,
    );

    const staleHealth = await diagnostics({ repoRoot, scanFreshness: true });
    expect(staleHealth).toMatchObject({
      staleStatus: "stale",
      freshnessMode: "scan",
      freshnessScanned: true,
      indexedFiles: 2,
      currentFiles: 2,
      missingFiles: 0,
      changedFiles: 1,
      extraFiles: 0,
    });
    expect(staleHealth.currentSnapshotHash).not.toBe(
      staleHealth.indexedSnapshotHash,
    );
    expect(staleHealth.staleReasons).toContain("content drift");
  });

  it("rejects file paths that escape the repository root", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    await expect(
      indexFile({
        repoRoot,
        filePath: "../outside.ts",
      }),
    ).rejects.toThrow(/escapes repository root/i);

    await expect(
      getFileContent({
        repoRoot,
        filePath: "../outside.ts",
      }),
    ).rejects.toThrow(/escapes repository root/i);

    await expect(
      getFileOutline({
        repoRoot,
        filePath: "../outside.ts",
      }),
    ).rejects.toThrow(/escapes repository root/i);
  }, 15000);
});
