import { execFileSync } from "node:child_process";
import { realpath, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { handleCli } from "../src/cli.ts";
import { indexFolder, searchSymbols } from "../src/index.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

afterEach(async () => {
  await cleanupFixtureRepos();
});

describe("cli boundaries", () => {
  it("returns a versioned JSON cache status for the explicit repository", async () => {
    const repoRoot = await createFixtureRepo();
    execFileSync("git", ["add", "."], { cwd: repoRoot });
    execFileSync(
      "git",
      ["-c", "user.name=Astrograph Test", "-c", "user.email=test@example.com", "commit", "-m", "fixture"],
      { cwd: repoRoot },
    );
    await indexFolder({ repoRoot });
    const result = JSON.parse(await handleCli(["cache-status", "--repo", repoRoot]));
    expect(result).toMatchObject({
      schemaVersion: 1,
      repoRoot: await realpath(repoRoot),
      storageLocation: expect.stringMatching(/^(repo-local|global)$/),
    });
    expect(result.checkout).toMatchObject({
      mode: "git-branch",
      repositoryId: null,
      headOid: expect.stringMatching(/^[a-f0-9]{40}$/),
      branchRef: expect.any(String),
      worktreePath: await realpath(repoRoot),
      diagnostic: null,
    });
    expect(result.checkout.indexedAt).toEqual(expect.any(String));
  });

  it("requires explicit all-cache scope before pruning", async () => {
    await expect(handleCli(["cache-prune", "--max-bytes", "0"])).rejects.toThrow(
      /cache prune requires explicit --all scope/i,
    );
  });

  it("lets explicit CLI storage selection override repository configuration for one command", async () => {
    const repoRoot = await createFixtureRepo();
    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({ storageLocation: "global" }),
    );
    const result = JSON.parse(await handleCli([
      "cache-status",
      "--repo",
      repoRoot,
      "--storage-location",
      "repo-local",
    ]));
    expect(result.storageLocation).toBe("repo-local");
    expect(process.env.ASTROGRAPH_STORAGE_LOCATION).toBeUndefined();
  });

  it("rejects malformed CLI numeric and enum arguments", async () => {
    const repoRoot = await createFixtureRepo();

    await expect(
      handleCli([
        "search-symbols",
        "--repo",
        repoRoot,
        "--query",
        "Greeter",
        "--kind",
        "bogus",
      ]),
    ).rejects.toThrow(
      /unsupported --kind: bogus\. expected one of: function, class, method, constant, type/i,
    );

    await expect(
      handleCli([
        "watch",
        "--repo",
        repoRoot,
        "--debounce-ms",
        "nope",
        "--timeout-ms",
        "50",
      ]),
    ).rejects.toThrow(/invalid numeric argument --debounce-ms/i);

    await expect(
      handleCli([
        "search-symbols",
        "--repo",
        repoRoot,
        "--query",
        "--kind",
        "class",
      ]),
    ).rejects.toThrow(/missing value for argument --query/i);

    await expect(
      handleCli([
        "search-symbols",
        "--repo",
        repoRoot,
        "--query",
        "Greeter",
        "--limit",
      ]),
    ).rejects.toThrow(/missing value for argument --limit/i);

    await expect(
      handleCli([
        "index-folder",
        "--repo",
        repoRoot,
        "--summary-strategy",
        "bogus",
      ]),
    ).rejects.toThrow(
      /unsupported --summary-strategy: bogus\. expected one of: doc-comments-first, signature-only/i,
    );

    await expect(
      handleCli([
        "search-symbols",
        "--repo",
        repoRoot,
        "--query",
        "Greeter",
        "--limit",
        "0",
      ]),
    ).rejects.toThrow(/limit must be positive/i);

    await expect(
      handleCli([
        "query-code",
        "--repo",
        repoRoot,
        "--intent",
        "assemble",
        "--query",
        "   ",
        "--symbols",
        "   ",
      ]),
    ).rejects.toThrow(/invalid option: expected one of "discover"\|"source"\|"auto"/i);

    await expect(
      handleCli([
        "get-context-bundle",
        "--repo",
        repoRoot,
        "--query",
        "   ",
        "--symbols",
        "   ",
      ]),
    ).rejects.toThrow(/unknown command: get-context-bundle/i);
  });

  it("preserves boolean flag and omitted optional number semantics", async () => {
    const repoRoot = await createFixtureRepo();
    const resolvedRepoRoot = await realpath(repoRoot);
    await indexFolder({ repoRoot });

    const [symbol] = await searchSymbols({
      repoRoot,
      query: "Greeter",
    });
    expect(symbol).toBeDefined();

    const verifiedSource = JSON.parse(
      await handleCli([
        "get-symbol-source",
        "--repo",
        repoRoot,
        "--symbol",
        symbol!.id,
        "--verify",
      ]),
    );

    expect(verifiedSource).toMatchObject({
      symbol: {
        id: symbol!.id,
      },
      verified: true,
    });

    const watchResult = JSON.parse(
      await handleCli([
        "watch",
        "--repo",
        repoRoot,
        "--debounce-ms",
        "25",
        "--timeout-ms",
        "10",
      ]),
    );

    expect(watchResult).toMatchObject({
      debounceMs: 25,
      stopReason: "timeout",
    });

    const signatureIndex = JSON.parse(
      await handleCli([
        "index-folder",
        "--repo",
        repoRoot,
        "--summary-strategy",
        "signature-only",
      ]),
    );

    expect(signatureIndex).toMatchObject({
      indexedFiles: 2,
      staleStatus: "fresh",
    });

    const diagnosticsResult = JSON.parse(
      await handleCli([
        "diagnostics",
        "--repo",
        repoRoot,
      ]),
    );

    expect(diagnosticsResult).toMatchObject({
      summaryStrategy: "signature-only",
      freshnessMode: "metadata",
      freshnessScanned: false,
    });

    const searchResult = JSON.parse(
      await handleCli([
        "search-symbols",
        "--repo",
        repoRoot,
        "--query",
        "Greeter",
        "--kind",
        "class",
      ]),
    );

    expect(searchResult).toMatchObject({ truncated: false });
    expect(searchResult.items).toHaveLength(1);
    expect(searchResult.items[0]).toMatchObject({
      id: symbol!.id,
      kind: "class",
    });

    const queryCodeResult = JSON.parse(
      await handleCli([
        "query-code",
        "--repo",
        repoRoot,
        "--intent",
        "source",
        "--symbol",
        symbol!.id,
        "--verify",
      ]),
    );

    expect(queryCodeResult).toMatchObject({
      intent: "source",
      symbolSource: {
        symbol: {
          id: symbol!.id,
        },
        verified: true,
      },
    });

    const doctorText = await handleCli([
      "doctor",
      "--repo",
      repoRoot,
    ]);
    expect(doctorText).toContain("Astrograph Doctor");
    expect(doctorText).toContain("Index: indexed");
    expect(doctorText).toContain("Parser: fallback 0.0%");

    const doctorJson = JSON.parse(
      await handleCli([
        "doctor",
        "--repo",
        repoRoot,
        "--json",
      ]),
    );
    expect(doctorJson).toMatchObject({
      repoRoot: resolvedRepoRoot,
      indexStatus: "indexed",
      freshness: {
        indexedFiles: 2,
        indexedSymbols: 5,
        indexedImports: 1,
      },
      parser: {
        indexedFileCount: 2,
        fallbackFileCount: 0,
        fallbackRate: 0,
      },
      observability: {
        enabled: false,
        status: "disabled",
      },
    });
  }, 45_000);
});
