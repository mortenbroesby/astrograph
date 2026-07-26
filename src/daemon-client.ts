import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { connect } from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import {
  MAX_DAEMON_MESSAGE_BYTES,
  encodeDaemonMessage,
  type DaemonResponse,
} from "./daemon-protocol.ts";
import { getDaemonRuntimeSummary, readDaemonRuntime, type DaemonState } from "./daemon-runtime.ts";
import { ASTROGRAPH_PACKAGE_VERSION } from "./version.ts";

const DEFAULT_DAEMON_REQUEST_TIMEOUT_MS = 10_000;
const DAEMON_START_TIMEOUT_MS = 5_000;
const DAEMON_START_RETRY_MS = 50;

const clientModulePath = fileURLToPath(import.meta.url);
const clientModuleDir = path.dirname(clientModulePath);
const builtDaemonEntrypoint = path.join(clientModuleDir, "daemon.js");
const sourceDaemonEntrypoint = path.join(clientModuleDir, "daemon.ts");

function startDaemonProcess(runtimeDir?: string) {
  const useBuiltEntrypoint = existsSync(builtDaemonEntrypoint) && !clientModulePath.endsWith(".ts");
  const child = spawn(process.execPath, useBuiltEntrypoint
    ? [builtDaemonEntrypoint]
    : ["--experimental-strip-types", sourceDaemonEntrypoint], {
    detached: true,
    stdio: "ignore",
    env: runtimeDir ? { ...process.env, ASTROGRAPH_RUNTIME_DIR: runtimeDir } : process.env,
  });
  child.unref();
  return child;
}

export async function ensureLocalDaemon(options: { runtimeDir?: string } = {}): Promise<DaemonState> {
  const existing = await readDaemonRuntime(options);
  const existingSummary = await getDaemonRuntimeSummary(options);
  if (existingSummary.status !== "stale"
    && existing?.status === "ready"
    && existing.version === ASTROGRAPH_PACKAGE_VERSION
    && existing.protocolVersion === 1) {
    return existing;
  }
  if (existing && existingSummary.status !== "stale" && existing.version !== ASTROGRAPH_PACKAGE_VERSION) {
    throw new Error(
      `Astrograph daemon version ${existing.version} is incompatible with ${ASTROGRAPH_PACKAGE_VERSION}; stop the old daemon before retrying`,
    );
  }

  const staleToken = existingSummary.status === "stale" ? existing?.token : null;
  const child = startDaemonProcess(options.runtimeDir);
  const startup = {
    exit: null as { code: number | null; signal: NodeJS.Signals | null } | null,
  };
  child.once("exit", (code, signal) => {
    startup.exit = { code, signal };
  });
  const deadline = Date.now() + DAEMON_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const state = await readDaemonRuntime(options);
    if (state?.status === "ready"
      && state.version === ASTROGRAPH_PACKAGE_VERSION
      && state.protocolVersion === 1
      && state.token !== staleToken) {
      return state;
    }
    const exited = startup.exit;
    if (exited) {
      const detail = exited.signal ? `signal ${exited.signal}` : `code ${exited.code ?? "unknown"}`;
      throw new Error(`Astrograph daemon exited before it became ready (${detail})`);
    }
    await delay(DAEMON_START_RETRY_MS);
  }
  throw new Error("Timed out starting the local Astrograph daemon; run diagnostics after confirming no stale daemon record remains");
}

export async function executeDaemonCommand(
  command: string,
  input: Record<string, unknown>,
  options: { runtimeDir?: string } = {},
): Promise<unknown> {
  const state = await ensureLocalDaemon(options);
  try {
    return await requestDaemon(state, command, input);
  } catch (error) {
    if ((await getDaemonRuntimeSummary(options)).status !== "stale") {
      throw error;
    }
    return requestDaemon(await ensureLocalDaemon(options), command, input);
  }
}

export async function requestDaemon(
  state: DaemonState,
  command: string,
  input: Record<string, unknown>,
  options: { timeoutMs?: number } = {},
): Promise<unknown> {
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    const socket = connect(state.endpoint);
    let buffered = "";
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Timed out waiting for the local Astrograph daemon"));
    }, options.timeoutMs ?? DEFAULT_DAEMON_REQUEST_TIMEOUT_MS);
    const finish = (callback: () => void) => {
      clearTimeout(timeout);
      socket.destroy();
      callback();
    };

    socket.setEncoding("utf8");
    socket.once("error", (error) => finish(() => reject(error)));
    socket.once("connect", () => {
      socket.write(encodeDaemonMessage({
        protocolVersion: 1,
        id,
        token: state.token,
        command,
        input,
      }));
    });
    socket.on("data", (chunk: string) => {
      buffered += chunk;
      if (Buffer.byteLength(buffered, "utf8") > MAX_DAEMON_MESSAGE_BYTES) {
        finish(() => reject(new Error("Daemon response exceeds maximum size")));
        return;
      }
      const delimiter = buffered.indexOf("\n");
      if (delimiter < 0) {
        return;
      }
      let response: DaemonResponse;
      try {
        response = JSON.parse(buffered.slice(0, delimiter)) as DaemonResponse;
      } catch {
        finish(() => reject(new Error("Daemon response must be JSON")));
        return;
      }
      if (response.id !== id) {
        finish(() => reject(new Error("Daemon response id did not match the request")));
        return;
      }
      if (!response.ok) {
        finish(() => reject(new Error(response.error.message)));
        return;
      }
      finish(() => resolve(response.data));
    });
  });
}
