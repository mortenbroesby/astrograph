import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  discoverSourceFiles,
  listSupportedFiles,
  loadFilesystemSnapshot,
  snapshotHash,
} from "../src/filesystem-scan.ts";

const tempDirs: string[] = [];

async function makeRepo() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-scan-"));
  tempDirs.push(repoRoot);
  execFileSync("git", ["init"], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "ignore"],
  });
  return repoRoot;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("astrograph filesystem scan", () => {
  it("discovers supported source files in deterministic order while skipping known junk directories", async () => {
    const repoRoot = await makeRepo();
    await mkdir(path.join(repoRoot, "src", "nested"), { recursive: true });
    await mkdir(path.join(repoRoot, "dist"), { recursive: true });
    await mkdir(path.join(repoRoot, "node_modules", "pkg"), { recursive: true });

    await writeFile(path.join(repoRoot, "src", "alpha.ts"), "export const alpha = 1;\n");
    await writeFile(path.join(repoRoot, "src", "nested", "beta.js"), "export const beta = 2;\n");
    await writeFile(path.join(repoRoot, "src", "notes.md"), "# unsupported\n");
    await writeFile(path.join(repoRoot, "dist", "bundle.ts"), "export const ignored = true;\n");
    await writeFile(path.join(repoRoot, "node_modules", "pkg", "index.ts"), "export const dep = true;\n");

    const result = await discoverSourceFiles({ repoRoot });

    expect(result.map((entry) => entry.relativePath)).toEqual([
      "src/alpha.ts",
      "src/nested/beta.js",
    ]);
    expect(result.map((entry) => entry.language)).toEqual(["ts", "js"]);
  });

  it("respects gitignore and preserves repo-relative paths for subtree discovery", async () => {
    const repoRoot = await makeRepo();
    await mkdir(path.join(repoRoot, "src", "deep"), { recursive: true });
    await writeFile(path.join(repoRoot, ".gitignore"), "src/ignored.ts\n");
    await writeFile(path.join(repoRoot, "src", "kept.ts"), "export const kept = true;\n");
    await writeFile(path.join(repoRoot, "src", "ignored.ts"), "export const ignored = true;\n");
    await writeFile(path.join(repoRoot, "src", "deep", "child.tsx"), "export const Child = () => null;\n");

    const result = await discoverSourceFiles({
      repoRoot,
      startRelativePath: "src",
    });

    expect(result.map((entry) => entry.relativePath)).toEqual([
      "src/deep/child.tsx",
      "src/kept.ts",
    ]);
    expect(await listSupportedFiles(repoRoot, path.join(repoRoot, "src"))).toEqual([
      "src/deep/child.tsx",
      "src/kept.ts",
    ]);
  });

  it("does not follow symlink escapes outside the repository root", async () => {
    const repoRoot = await makeRepo();
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-scan-outside-"));
    tempDirs.push(outsideRoot);

    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await mkdir(path.join(outsideRoot, "external"), { recursive: true });
    await writeFile(path.join(outsideRoot, "external", "escape.ts"), "export const escape = true;\n");
    await symlink(
      path.join(outsideRoot, "external"),
      path.join(repoRoot, "src", "linked-external"),
      "dir",
    );
    await writeFile(path.join(repoRoot, "src", "safe.ts"), "export const safe = true;\n");

    const result = await discoverSourceFiles({ repoRoot });

    expect(result.map((entry) => entry.relativePath)).toEqual(["src/safe.ts"]);
  });

  it("supports compiled include and exclude globs during discovery", async () => {
    const repoRoot = await makeRepo();
    await mkdir(path.join(repoRoot, "src", "nested"), { recursive: true });

    await writeFile(path.join(repoRoot, "src", "keep.ts"), "export const keep = true;\n");
    await writeFile(
      path.join(repoRoot, "src", "skip.test.ts"),
      "export const skip = true;\n",
    );
    await writeFile(
      path.join(repoRoot, "src", "nested", ".hidden.ts"),
      "export const hidden = true;\n",
    );

    const result = await discoverSourceFiles({
      repoRoot,
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
    });

    expect(result.map((entry) => entry.relativePath)).toEqual([
      "src/keep.ts",
      "src/nested/.hidden.ts",
    ]);
  });

  it("uses routine fingerprint hashes for filesystem snapshots", async () => {
    const repoRoot = await makeRepo();
    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await writeFile(path.join(repoRoot, "src", "alpha.ts"), "export const alpha = 1;\n");

    const snapshot = await loadFilesystemSnapshot(repoRoot);

    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]?.contentHash).toMatch(/^xxh64:[0-9a-f]{16}$/u);
    expect(snapshotHash(snapshot)).toMatch(/^xxh64:[0-9a-f]{16}$/u);
  });

  it("skips files that exceed maxFileBytes during discovery", async () => {
    const repoRoot = await makeRepo();
    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await writeFile(path.join(repoRoot, "src", "small.ts"), "export const small = 1;\n");
    await writeFile(path.join(repoRoot, "src", "large.ts"), "x".repeat(64));

    const result = await discoverSourceFiles({
      repoRoot,
      maxFileBytes: 32,
    });

    expect(result.map((entry) => entry.relativePath)).toEqual(["src/small.ts"]);
  });

  it("fails clearly when discovered files exceed maxFilesDiscovered", async () => {
    const repoRoot = await makeRepo();
    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await writeFile(path.join(repoRoot, "src", "one.ts"), "export const one = 1;\n");
    await writeFile(path.join(repoRoot, "src", "two.ts"), "export const two = 2;\n");

    await expect(
      discoverSourceFiles({
        repoRoot,
        maxFilesDiscovered: 1,
      }),
    ).rejects.toThrow(/exceeding maxFilesDiscovered=1/i);
  });
});
