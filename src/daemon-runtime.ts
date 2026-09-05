import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { resolveGlobalConfigPath } from "./config.ts";
import { DAEMON_PROTOCOL_VERSION } from "./daemon-protocol.ts";
import { ASTROGRAPH_PACKAGE_VERSION } from "./version.ts";

const RUNTIME_DIRECTORY_ENV = "ASTROGRAPH_RUNTIME_DIR";
const DAEMON_STATE_FILENAME = "daemon.json";
const DAEMON_HANDOFF_FILENAME = "handoff.json";

export type DaemonStateStatus = "starting" | "ready";

export interface DaemonState {
  schemaVersion: 1;
  status: DaemonStateStatus;
  pid: number;
  startedAt: string;
  version: string;
  protocolVersion: typeof DAEMON_PROTOCOL_VERSION;
  endpoint: string;
  token: string;
}

export interface DaemonRuntimeSummary {
  status: "running" | "starting" | "stale" | "unavailable";
  version: string | null;
  warning: string | null;
}

export interface DaemonRuntimeOptions {
  runtimeDir?: string;
  pid?: number;
  now?: () => Date;
  token?: string;
  version?: string;
  isProcessAlive?: (pid: number) => boolean;
}

export interface DaemonHandoffOptions {
  runtimeDir?: string;
  pid?: number;
  now?: () => Date;
  targetVersion?: string;
  ownerId?: string;
  isProcessAlive?: (pid: number) => boolean;
}

export type DaemonClaim =
  | { kind: "claimed"; state: DaemonState; statePath: string }
  | { kind: "occupied"; state: DaemonState; statePath: string }
  | { kind: "invalid"; statePath: string };

export interface DaemonHandoffState {
  schemaVersion: 1;
  pid: number;
  startedAt: string;
  targetVersion: string;
  ownerId: string;
}

export type DaemonHandoffClaim =
  | { kind: "claimed"; state: DaemonHandoffState; statePath: string }
  | { kind: "occupied"; state: DaemonHandoffState; statePath: string }
  | { kind: "invalid"; statePath: string };

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

export function resolveRuntimeDirectory(runtimeDir?: string): string {
  return runtimeDir
    ?? process.env[RUNTIME_DIRECTORY_ENV]
    ?? path.join(path.dirname(resolveGlobalConfigPath()), "runtime");
}

export function resolveDaemonStatePath(runtimeDir?: string): string {
  return path.join(resolveRuntimeDirectory(runtimeDir), DAEMON_STATE_FILENAME);
}

export function resolveDaemonHandoffPath(runtimeDir?: string): string {
  return path.join(resolveRuntimeDirectory(runtimeDir), DAEMON_HANDOFF_FILENAME);
}

function defaultEndpoint(runtimeDir: string): string {
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\astrograph-${process.getuid?.() ?? "user"}`;
  }
  return path.join(runtimeDir, "daemon.sock");
}

function createState(options: DaemonRuntimeOptions): DaemonState {
  const runtimeDir = resolveRuntimeDirectory(options.runtimeDir);
  return {
    schemaVersion: 1,
    status: "starting",
    pid: options.pid ?? process.pid,
    startedAt: (options.now ?? (() => new Date()))().toISOString(),
    version: options.version ?? ASTROGRAPH_PACKAGE_VERSION,
    protocolVersion: DAEMON_PROTOCOL_VERSION,
    endpoint: defaultEndpoint(runtimeDir),
    token: options.token ?? randomBytes(32).toString("base64url"),
  };
}

function isDaemonState(value: unknown): value is DaemonState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const state = value as Partial<DaemonState>;
  return state.schemaVersion === 1
    && (state.status === "starting" || state.status === "ready")
    && typeof state.pid === "number"
    && Number.isSafeInteger(state.pid)
    && state.pid > 0
    && typeof state.startedAt === "string"
    && typeof state.version === "string"
    && state.protocolVersion === DAEMON_PROTOCOL_VERSION
    && typeof state.endpoint === "string"
    && state.endpoint.length > 0
    && typeof state.token === "string"
    && state.token.length >= 32;
}

async function readState(statePath: string): Promise<DaemonState | null> {
  const contents = await readFile(statePath, "utf8").catch(() => null);
  if (contents === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(contents);
    return isDaemonState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isDaemonHandoffState(value: unknown): value is DaemonHandoffState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Partial<DaemonHandoffState>;
  return state.schemaVersion === 1
    && typeof state.pid === "number"
    && Number.isSafeInteger(state.pid)
    && state.pid > 0
    && typeof state.startedAt === "string"
    && typeof state.targetVersion === "string"
    && state.targetVersion.length > 0
    && typeof state.ownerId === "string"
    && state.ownerId.length >= 16;
}

export async function readDaemonHandoff(options: { runtimeDir?: string } = {}): Promise<DaemonHandoffState | null> {
  const contents = await readFile(resolveDaemonHandoffPath(options.runtimeDir), "utf8").catch(() => null);
  if (contents === null) return null;
  try {
    const parsed: unknown = JSON.parse(contents);
    return isDaemonHandoffState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function claimDaemonHandoff(options: DaemonHandoffOptions = {}): Promise<DaemonHandoffClaim> {
  const runtimeDir = resolveRuntimeDirectory(options.runtimeDir);
  const statePath = resolveDaemonHandoffPath(runtimeDir);
  const state: DaemonHandoffState = {
    schemaVersion: 1,
    pid: options.pid ?? process.pid,
    startedAt: (options.now ?? (() => new Date()))().toISOString(),
    targetVersion: options.targetVersion ?? ASTROGRAPH_PACKAGE_VERSION,
    ownerId: options.ownerId ?? randomBytes(16).toString("hex"),
  };
  await mkdir(runtimeDir, { recursive: true, mode: 0o700 });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(statePath, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify(state)}\n`);
      await handle.close();
      return { kind: "claimed", state, statePath };
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST") throw error;
    }
    const existing = await readDaemonHandoff({ runtimeDir });
    if (!existing) return { kind: "invalid", statePath };
    if ((options.isProcessAlive ?? defaultIsProcessAlive)(existing.pid)) {
      return { kind: "occupied", state: existing, statePath };
    }
    await rm(statePath, { force: true });
  }
  return { kind: "invalid", statePath };
}

export async function releaseDaemonHandoff(
  claim: Extract<DaemonHandoffClaim, { kind: "claimed" }>,
): Promise<void> {
  const existing = await readDaemonHandoff({ runtimeDir: path.dirname(claim.statePath) });
  if (existing?.ownerId === claim.state.ownerId) await rm(claim.statePath, { force: true });
}

async function writeState(statePath: string, state: DaemonState): Promise<void> {
  const temporaryPath = `${statePath}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state)}\n`, { mode: 0o600 });
  await rename(temporaryPath, statePath);
}

export async function claimDaemonRuntime(
  options: DaemonRuntimeOptions = {},
): Promise<DaemonClaim> {
  const runtimeDir = resolveRuntimeDirectory(options.runtimeDir);
  const statePath = resolveDaemonStatePath(runtimeDir);
  const state = createState(options);

  await mkdir(runtimeDir, { recursive: true, mode: 0o700 });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(statePath, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify(state)}\n`);
      await handle.close();
      return { kind: "claimed", state, statePath };
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
    }

    const existing = await readState(statePath);
    if (!existing) {
      return { kind: "invalid", statePath };
    }
    if ((options.isProcessAlive ?? defaultIsProcessAlive)(existing.pid)) {
      return { kind: "occupied", state: existing, statePath };
    }
    await rm(statePath, { force: true });
  }

  return { kind: "invalid", statePath };
}

export async function markDaemonReady(claim: Extract<DaemonClaim, { kind: "claimed" }>): Promise<DaemonState> {
  const ready: DaemonState = { ...claim.state, status: "ready" };
  await writeState(claim.statePath, ready);
  return ready;
}

export async function releaseDaemonRuntime(
  claim: Extract<DaemonClaim, { kind: "claimed" }>,
): Promise<void> {
  const existing = await readState(claim.statePath);
  if (existing?.pid === claim.state.pid && existing.token === claim.state.token) {
    await rm(claim.statePath, { force: true });
  }
}

export async function readDaemonRuntime(options: { runtimeDir?: string } = {}): Promise<DaemonState | null> {
  return readState(resolveDaemonStatePath(options.runtimeDir));
}

export async function clearStaleDaemonRuntime(options: DaemonRuntimeOptions = {}): Promise<boolean> {
  if ((await getDaemonRuntimeSummary(options)).status !== "stale") {
    return false;
  }
  const claim = await claimDaemonRuntime(options);
  if (claim.kind !== "claimed") {
    return false;
  }
  await releaseDaemonRuntime(claim);
  return true;
}

export async function getDaemonRuntimeSummary(
  options: { runtimeDir?: string; isProcessAlive?: (pid: number) => boolean } = {},
): Promise<DaemonRuntimeSummary> {
  const state = await readDaemonRuntime(options);
  if (!state) {
    return { status: "unavailable", version: null, warning: null };
  }
  if (!(options.isProcessAlive ?? defaultIsProcessAlive)(state.pid)) {
    return {
      status: "stale",
      version: state.version,
      warning: "A stale Astrograph daemon record was found; start Astrograph again to recover it.",
    };
  }
  return {
    status: state.status === "ready" ? "running" : "starting",
    version: state.version,
    warning: null,
  };
}
