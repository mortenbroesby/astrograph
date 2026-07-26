import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { resolveGlobalConfigPath } from "./config.ts";
import { ASTROGRAPH_PACKAGE_VERSION } from "./version.ts";

const RUNTIME_DIRECTORY_ENV = "ASTROGRAPH_RUNTIME_DIR";
const PROCESS_WARNING_THRESHOLD = 5;

export interface RuntimePresenceSummary {
  schemaVersion: 1;
  liveProcessCount: number;
  staleRecordCount: number;
  invalidRecordCount: number;
  warning: string | null;
}

interface RuntimePresenceRecord {
  schemaVersion: 1;
  pid: number;
  startedAt: string;
  transport: "stdio";
  version: string;
}

export interface RuntimePresenceHandle {
  close(): Promise<void>;
}

interface RuntimePresenceOptions {
  runtimeDir?: string;
  isProcessAlive?: (pid: number) => boolean;
}

function resolveRuntimeDir(runtimeDir?: string): string {
  return runtimeDir
    ?? process.env[RUNTIME_DIRECTORY_ENV]
    ?? path.join(path.dirname(resolveGlobalConfigPath()), "runtime");
}

function isValidRecord(value: unknown, expectedPid: number): value is RuntimePresenceRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<RuntimePresenceRecord>;
  return record.schemaVersion === 1
    && record.pid === expectedPid
    && Number.isSafeInteger(record.pid)
    && record.pid > 0
    && typeof record.startedAt === "string"
    && typeof record.version === "string"
    && record.transport === "stdio";
}

function defaultIsProcessAlive(pid: number): boolean {
  if (pid === process.pid) {
    return true;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return Boolean(error && typeof error === "object" && "code" in error && error.code === "EPERM");
  }
}

async function removeRecord(recordPath: string): Promise<void> {
  await rm(recordPath, { force: true }).catch(() => undefined);
}

export async function registerRuntimePresence(
  options: { runtimeDir?: string } = {},
): Promise<RuntimePresenceHandle> {
  const runtimeDir = resolveRuntimeDir(options.runtimeDir);
  const recordPath = path.join(runtimeDir, `${process.pid}.json`);
  const temporaryPath = path.join(runtimeDir, `.${process.pid}.${randomUUID()}.tmp`);
  const record: RuntimePresenceRecord = {
    schemaVersion: 1,
    pid: process.pid,
    startedAt: new Date().toISOString(),
    transport: "stdio",
    version: ASTROGRAPH_PACKAGE_VERSION,
  };

  await mkdir(runtimeDir, { recursive: true, mode: 0o700 });
  await writeFile(temporaryPath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  await rename(temporaryPath, recordPath);

  let closed = false;
  return {
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      await removeRecord(recordPath);
    },
  };
}

export async function getRuntimePresenceSummary(
  options: RuntimePresenceOptions = {},
): Promise<RuntimePresenceSummary> {
  const runtimeDir = resolveRuntimeDir(options.runtimeDir);
  const isProcessAlive = options.isProcessAlive ?? defaultIsProcessAlive;
  const entries = await readdir(runtimeDir, { withFileTypes: true }).catch(() => []);
  let liveProcessCount = 0;
  let staleRecordCount = 0;
  let invalidRecordCount = 0;

  await Promise.all(entries.map(async (entry) => {
    const match = /^(\d+)\.json$/.exec(entry.name);
    if (!entry.isFile() || !match) {
      return;
    }

    const recordPath = path.join(runtimeDir, entry.name);
    const pid = Number(match[1]);
    const contents = await readFile(recordPath, "utf8").catch(() => null);
    if (contents === null) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch {
      invalidRecordCount += 1;
      await removeRecord(recordPath);
      return;
    }

    if (!isValidRecord(parsed, pid)) {
      invalidRecordCount += 1;
      await removeRecord(recordPath);
      return;
    }

    if (!isProcessAlive(pid)) {
      staleRecordCount += 1;
      await removeRecord(recordPath);
      return;
    }

    liveProcessCount += 1;
  }));

  return {
    schemaVersion: 1,
    liveProcessCount,
    staleRecordCount,
    invalidRecordCount,
    warning: liveProcessCount > PROCESS_WARNING_THRESHOLD
      ? `${liveProcessCount} live Astrograph MCP processes detected; close unused agent sessions to release local resources.`
      : null,
  };
}
