import { createServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import { afterEach, describe, expect, it } from "vitest";

import { executeDaemonCommand } from "../src/daemon-client.ts";
import { getDaemonRuntimeSummary, readDaemonRuntime, resolveDaemonStatePath } from "../src/daemon-runtime.ts";

const temporaryPaths: string[] = [];
const daemonPids: number[] = [];
const PROCESS_TEST_TIMEOUT_MS = 80_000;

async function supportsUnixSockets(): Promise<boolean> {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), "astrograph-daemon-capability-"));
  const server = createServer();
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(path.join(runtimeDir, "daemon.sock"), () => {
        server.off("error", reject);
        resolve();
      });
    });
    return true;
  } catch {
    return false;
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await rm(runtimeDir, { recursive: true, force: true });
  }
}

const describeDaemonProcess = await supportsUnixSockets() ? describe.sequential : describe.skip;

async function createTempPath(prefix: string): Promise<string> {
  const value = await mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryPaths.push(value);
  return value;
}

async function stopDaemon(runtimeDir: string): Promise<void> {
  const state = await readDaemonRuntime({ runtimeDir });
  if (!state) {
    return;
  }
  daemonPids.push(state.pid);
  process.kill(state.pid, "SIGTERM");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (!await readDaemonRuntime({ runtimeDir })) {
      return;
    }
    await delay(20);
  }
  throw new Error("daemon did not remove its runtime record after SIGTERM");
}

afterEach(async () => {
  await Promise.all(daemonPids.splice(0).map((pid) => {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // The daemon already exited.
    }
  }));
  await Promise.all(temporaryPaths.splice(0).map((target) =>
    rm(target, { recursive: true, force: true }),
  ));
});

describeDaemonProcess("daemon process", () => {
  it("starts one child daemon, indexes through IPC, and releases its runtime state", async () => {
    const runtimeDir = await createTempPath("astrograph-daemon-runtime-");
    const repoRoot = await createTempPath("astrograph-daemon-repo-");
    await writeFile(path.join(repoRoot, "index.ts"), "export function daemonProof() { return 1; }\n");

    const indexed = await executeDaemonCommand("index_folder", { repoRoot }, { runtimeDir });
    expect(indexed).toMatchObject({ indexedFiles: 1, staleStatus: "fresh" });

    const searched = await executeDaemonCommand("search_symbols", {
      repoRoot,
      query: "daemonProof",
    }, { runtimeDir });
    expect(searched).toMatchObject({ items: [expect.objectContaining({ name: "daemonProof" })] });

    await writeFile(
      path.join(repoRoot, "index.ts"),
      "export function daemonProof() { return 1; }\nexport function daemonWatcherProof() { return 2; }\n",
    );
    let watcherResult: unknown = null;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      watcherResult = await executeDaemonCommand("search_symbols", {
        repoRoot,
        query: "daemonWatcherProof",
      }, { runtimeDir });
      if ((watcherResult as { items?: unknown[] }).items?.length) {
        break;
      }
      await delay(25);
    }
    expect(watcherResult).toMatchObject({
      items: [expect.objectContaining({ name: "daemonWatcherProof" })],
    });

    await stopDaemon(runtimeDir);
  }, PROCESS_TEST_TIMEOUT_MS);

  it("recovers from a crashed daemon record without creating a competing owner", async () => {
    const runtimeDir = await createTempPath("astrograph-daemon-runtime-");
    const repoRoot = await createTempPath("astrograph-daemon-repo-");
    await writeFile(path.join(repoRoot, "index.ts"), "export const recoveredDaemon = true;\n");

    await executeDaemonCommand("index_folder", { repoRoot }, { runtimeDir });
    const crashed = await readDaemonRuntime({ runtimeDir });
    if (!crashed) {
      throw new Error("expected a running daemon");
    }
    process.kill(crashed.pid, "SIGKILL");
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if ((await getDaemonRuntimeSummary({ runtimeDir })).status === "stale") {
        break;
      }
      await delay(20);
    }
    expect((await getDaemonRuntimeSummary({ runtimeDir })).status).toBe("stale");

    const searched = await executeDaemonCommand("search_symbols", {
      repoRoot,
      query: "recoveredDaemon",
    }, { runtimeDir });
    expect(searched).toMatchObject({ items: [expect.objectContaining({ name: "recoveredDaemon" })] });
    const recovered = await readDaemonRuntime({ runtimeDir });
    expect(recovered?.pid).not.toBe(crashed.pid);

    await stopDaemon(runtimeDir);
  }, PROCESS_TEST_TIMEOUT_MS);

  it("replaces a reachable incompatible daemon before the next command", async () => {
    const runtimeDir = await createTempPath("astrograph-daemon-runtime-");
    const repoRoot = await createTempPath("astrograph-daemon-repo-");
    await writeFile(path.join(repoRoot, "index.ts"), "export const replacementProof = true;\n");

    await executeDaemonCommand("index_folder", { repoRoot }, { runtimeDir });
    const previous = await readDaemonRuntime({ runtimeDir });
    if (!previous) throw new Error("expected a running daemon");
    await writeFile(resolveDaemonStatePath(runtimeDir), JSON.stringify({ ...previous, version: "previous-version" }));

    const results = await Promise.all(Array.from({ length: 6 }, () => executeDaemonCommand("search_symbols", {
      repoRoot,
      query: "replacementProof",
    }, { runtimeDir })));
    for (const result of results) {
      expect(result).toMatchObject({ items: [expect.objectContaining({ name: "replacementProof" })] });
    }
    const replacement = await readDaemonRuntime({ runtimeDir });
    expect(replacement?.pid).not.toBe(previous.pid);
    expect(replacement?.version).not.toBe("previous-version");

    await stopDaemon(runtimeDir);
  }, PROCESS_TEST_TIMEOUT_MS);
});
