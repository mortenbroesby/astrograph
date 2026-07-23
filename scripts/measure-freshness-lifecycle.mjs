import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

import {
  clearStorageProcessCaches,
  diagnostics,
  indexFolder,
  watchFolder,
} from "../src/index.ts";

const execFile = promisify(execFileCallback);

async function createFixture(label) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), `astrograph-${label}-`));
  await mkdir(path.join(repoRoot, "src"), { recursive: true });
  await writeFile(
    path.join(repoRoot, "astrograph.config.json"),
    JSON.stringify({
      storageLocation: "repo-local",
      watch: { backend: "polling", debounceMs: 50 },
    }),
  );
  await writeFile(
    path.join(repoRoot, "src", "math.ts"),
    'export const area = (radius) => radius * radius;\n',
  );
  await writeFile(
    path.join(repoRoot, "src", "strings.ts"),
    'export const label = (value) => `value=${value}`;\n',
  );
  await execFile("git", ["init"], { cwd: repoRoot });
  await execFile("git", ["config", "user.email", "astrograph-benchmark@example.invalid"], {
    cwd: repoRoot,
  });
  await execFile("git", ["config", "user.name", "Astrograph Benchmark"], { cwd: repoRoot });
  await execFile("git", ["add", "."], { cwd: repoRoot });
  await execFile("git", ["commit", "-m", "initial fixture"], { cwd: repoRoot });
  return repoRoot;
}

async function measure(label, action) {
  const startedAt = performance.now();
  const value = await action();
  return {
    label,
    elapsedMs: Number((performance.now() - startedAt).toFixed(1)),
    ...value,
  };
}

function summaryValue(summary) {
  return {
    indexedFiles: summary.indexedFiles,
    indexedSymbols: summary.indexedSymbols,
    reusedFiles: summary.reusedFiles,
    parsedFiles: summary.parsedFiles,
    removedFiles: summary.removedFiles,
    staleStatus: summary.staleStatus,
  };
}

async function waitFor(predicate, timeoutMs = 4_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for polling refresh");
    }
    await delay(20);
  }
}

async function runFolderLifecycle() {
  const repoRoot = await createFixture("freshness-baseline");
  try {
    const measurements = [];
    measurements.push(await measure("cold-index", async () => summaryValue(await indexFolder({ repoRoot }))));
    measurements.push(await measure("no-op-refresh", async () => summaryValue(await indexFolder({ repoRoot }))));
    await writeFile(path.join(repoRoot, "src", "math.ts"), "export const changed = true;\n");
    measurements.push(await measure("one-file-edit", async () => summaryValue(await indexFolder({ repoRoot }))));
    await rename(path.join(repoRoot, "src", "math.ts"), path.join(repoRoot, "src", "math-renamed.ts"));
    measurements.push(await measure("rename", async () => summaryValue(await indexFolder({ repoRoot }))));
    await rm(path.join(repoRoot, "src", "math-renamed.ts"));
    measurements.push(await measure("delete", async () => summaryValue(await indexFolder({ repoRoot }))));
    return measurements;
  } finally {
    clearStorageProcessCaches();
    await rm(repoRoot, { recursive: true, force: true });
  }
}

async function runCheckoutLifecycle() {
  const repoRoot = await createFixture("checkout-baseline");
  try {
    await indexFolder({ repoRoot });
    const { stdout: initialHead } = await execFile("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
    await execFile("git", ["checkout", "-b", "freshness-change"], { cwd: repoRoot });
    await writeFile(path.join(repoRoot, "src", "math.ts"), "export const checkoutSpecific = true;\n");
    await execFile("git", ["add", "src/math.ts"], { cwd: repoRoot });
    await execFile("git", ["commit", "-m", "checkout change"], { cwd: repoRoot });
    const changed = await measure("checkout-change", async () => summaryValue(await indexFolder({ repoRoot })));
    await execFile("git", ["checkout", "--detach", initialHead.trim()], { cwd: repoRoot });
    const restored = await measure("checkout-restore", async () => summaryValue(await indexFolder({ repoRoot })));
    const health = await diagnostics({ repoRoot, scanFreshness: true });
    return { changed, restored, staleStatus: health.staleStatus, staleReasons: health.staleReasons };
  } finally {
    clearStorageProcessCaches();
    await rm(repoRoot, { recursive: true, force: true });
  }
}

async function runUnavailableGitLifecycle() {
  const repoRoot = await createFixture("no-git-baseline");
  const originalPath = process.env.PATH;
  const emptyPath = await mkdtemp(path.join(os.tmpdir(), "astrograph-no-git-path-"));
  try {
    await indexFolder({ repoRoot });
    process.env.PATH = emptyPath;
    await writeFile(path.join(repoRoot, "src", "math.ts"), "export const indexedWithoutGit = true;\n");
    const result = await measure("git-unavailable", async () => summaryValue(await indexFolder({ repoRoot })));
    return result;
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    clearStorageProcessCaches();
    await rm(emptyPath, { recursive: true, force: true });
    await rm(repoRoot, { recursive: true, force: true });
  }
}

async function runPollingLifecycle() {
  const repoRoot = await createFixture("polling-baseline");
  const events = [];
  const watcher = await watchFolder({
    repoRoot,
    onEvent(event) {
      if (event.type === "reindex" && event.summary) {
        events.push(summaryValue(event.summary));
      }
    },
  });
  try {
    await writeFile(path.join(repoRoot, "src", "math.ts"), "export const polled = true;\n");
    const result = await measure("polling-fallback", async () => {
      await waitFor(() => events.length === 1);
      return events[0];
    });
    const health = await diagnostics({ repoRoot });
    return { ...result, backend: health.watch.backend, staleStatus: health.staleStatus };
  } finally {
    await watcher.close();
    clearStorageProcessCaches();
    await rm(repoRoot, { recursive: true, force: true });
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  folderLifecycle: await runFolderLifecycle(),
  checkoutLifecycle: await runCheckoutLifecycle(),
  unavailableGit: await runUnavailableGitLifecycle(),
  pollingFallback: await runPollingLifecycle(),
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
