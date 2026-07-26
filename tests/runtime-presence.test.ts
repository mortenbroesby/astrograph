import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  getRuntimePresenceSummary,
  registerRuntimePresence,
} from "../src/runtime-presence.ts";

const runtimeDirs: string[] = [];

async function createRuntimeDir() {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), "astrograph-runtime-"));
  runtimeDirs.push(runtimeDir);
  return runtimeDir;
}

afterEach(async () => {
  await Promise.all(runtimeDirs.splice(0).map((runtimeDir) =>
    rm(runtimeDir, { recursive: true, force: true }),
  ));
});

describe("runtime presence", () => {
  it("writes only source-free process metadata and removes it idempotently", async () => {
    const runtimeDir = await createRuntimeDir();
    const presence = await registerRuntimePresence({ runtimeDir });
    const recordPath = path.join(runtimeDir, `${process.pid}.json`);

    const record = await readFile(recordPath, "utf8");
    expect(JSON.parse(record)).toEqual(expect.objectContaining({
      schemaVersion: 1,
      pid: process.pid,
      transport: "stdio",
    }));
    expect(record).not.toMatch(/repo|source|query|index/i);

    await presence.close();
    await presence.close();
    await expect(readFile(recordPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("prunes malformed and dead records without exposing record details", async () => {
    const runtimeDir = await createRuntimeDir();
    await writeFile(path.join(runtimeDir, "123.json"), "not json");
    await writeFile(path.join(runtimeDir, "456.json"), JSON.stringify({
      schemaVersion: 1,
      pid: 456,
      startedAt: "2026-07-26T00:00:00.000Z",
      transport: "stdio",
      version: "test",
      repoRoot: "/private/source",
    }));

    const summary = await getRuntimePresenceSummary({
      runtimeDir,
      isProcessAlive: () => false,
    });

    expect(summary).toEqual({
      schemaVersion: 1,
      liveProcessCount: 0,
      staleRecordCount: 1,
      invalidRecordCount: 1,
      warning: null,
      daemon: { status: "unavailable", version: null, warning: null },
    });
    await expect(readFile(path.join(runtimeDir, "123.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(path.join(runtimeDir, "456.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(JSON.stringify(summary)).not.toContain("/private/source");
  });

  it("warns only above the bounded process threshold", async () => {
    const runtimeDir = await createRuntimeDir();
    await Promise.all([1, 2, 3, 4, 5, 6].map((pid) => writeFile(
      path.join(runtimeDir, `${pid}.json`),
      JSON.stringify({ schemaVersion: 1, pid, startedAt: "2026-07-26T00:00:00.000Z", transport: "stdio", version: "test" }),
    )));

    const summary = await getRuntimePresenceSummary({ runtimeDir, isProcessAlive: () => true });
    expect(summary.liveProcessCount).toBe(6);
    expect(summary.staleRecordCount).toBe(0);
    expect(summary.invalidRecordCount).toBe(0);
    expect(summary.warning).toContain("6 live Astrograph MCP processes");
    expect(summary.daemon.status).toBe("unavailable");
  });
});
