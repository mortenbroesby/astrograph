import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  claimDaemonRuntime,
  clearStaleDaemonRuntime,
  getDaemonRuntimeSummary,
  markDaemonReady,
  readDaemonRuntime,
  releaseDaemonRuntime,
  resolveDaemonStatePath,
} from "../src/daemon-runtime.ts";

const runtimeDirs: string[] = [];

async function createRuntimeDir() {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), "astrograph-daemon-"));
  runtimeDirs.push(runtimeDir);
  return runtimeDir;
}

afterEach(async () => {
  await Promise.all(runtimeDirs.splice(0).map((runtimeDir) =>
    rm(runtimeDir, { recursive: true, force: true }),
  ));
});

describe("daemon runtime", () => {
  it("claims one private runtime, marks readiness, and releases only its own record", async () => {
    const runtimeDir = await createRuntimeDir();
    const first = await claimDaemonRuntime({ runtimeDir, token: "a".repeat(32) });
    expect(first.kind).toBe("claimed");
    if (first.kind !== "claimed") {
      throw new Error("expected daemon claim");
    }
    expect(first.state.endpoint).toContain(runtimeDir);
    expect(first.state.status).toBe("starting");

    const second = await claimDaemonRuntime({ runtimeDir, token: "b".repeat(32) });
    expect(second).toMatchObject({ kind: "occupied", state: { pid: process.pid } });

    const ready = await markDaemonReady(first);
    expect(ready.status).toBe("ready");
    expect(await readDaemonRuntime({ runtimeDir })).toEqual(ready);

    await releaseDaemonRuntime(first);
    await expect(readFile(resolveDaemonStatePath(runtimeDir), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not overwrite malformed state and keeps state free of repository data", async () => {
    const runtimeDir = await createRuntimeDir();
    const statePath = resolveDaemonStatePath(runtimeDir);
    await writeFile(statePath, "not-json", { mode: 0o600 });

    expect(await claimDaemonRuntime({ runtimeDir })).toEqual({ kind: "invalid", statePath });

    await rm(statePath);
    const claim = await claimDaemonRuntime({ runtimeDir, token: "a".repeat(32) });
    if (claim.kind !== "claimed") {
      throw new Error("expected daemon claim");
    }
    const record = await readFile(statePath, "utf8");
    expect(record).not.toMatch(/repoRoot|source|query|index/i);
  });

  it("recovers a demonstrably dead daemon owner before claiming the runtime", async () => {
    const runtimeDir = await createRuntimeDir();
    await writeFile(resolveDaemonStatePath(runtimeDir), JSON.stringify({
      schemaVersion: 1,
      status: "ready",
      pid: 42,
      startedAt: "2026-07-26T00:00:00.000Z",
      version: "test",
      protocolVersion: 1,
      endpoint: path.join(runtimeDir, "daemon.sock"),
      token: "a".repeat(32),
    }));

    const claim = await claimDaemonRuntime({
      runtimeDir,
      token: "b".repeat(32),
      isProcessAlive: () => false,
    });

    expect(claim).toMatchObject({ kind: "claimed", state: { token: "b".repeat(32) } });
  });

  it("clears a stale daemon record without starting a replacement", async () => {
    const runtimeDir = await createRuntimeDir();
    const claim = await claimDaemonRuntime({ runtimeDir });
    if (claim.kind !== "claimed") throw new Error("expected daemon claim");
    await markDaemonReady(claim);

    await expect(clearStaleDaemonRuntime({ runtimeDir, isProcessAlive: () => false })).resolves.toBe(true);
    await expect(readDaemonRuntime({ runtimeDir })).resolves.toBeNull();
  });

  it("reports source-free running and stale daemon health", async () => {
    const runtimeDir = await createRuntimeDir();
    const claim = await claimDaemonRuntime({ runtimeDir, token: "a".repeat(32) });
    if (claim.kind !== "claimed") {
      throw new Error("expected daemon claim");
    }
    await markDaemonReady(claim);
    await expect(getDaemonRuntimeSummary({ runtimeDir, isProcessAlive: () => true })).resolves.toEqual({
      status: "running",
      version: claim.state.version,
      warning: null,
    });
    await expect(getDaemonRuntimeSummary({ runtimeDir, isProcessAlive: () => false })).resolves.toMatchObject({
      status: "stale",
      warning: expect.stringContaining("stale"),
    });
  });
});
