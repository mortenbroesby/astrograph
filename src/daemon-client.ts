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
import { readDaemonRuntime, type DaemonState } from "./daemon-runtime.ts";
import { ASTROGRAPH_PACKAGE_VERSION } from "./version.ts";

const DEFAULT_DAEMON_REQUEST_TIMEOUT_MS = 10_000;
const DAEMON_START_TIMEOUT_MS = 5_000;
const DAEMON_START_RETRY_MS = 50;

const clientModulePath = fileURLToPath(import.meta.url);
const clientModuleDir = path.dirname(clientModulePath);
const builtDaemonEntrypoint = path.join(clientModuleDir, "daemon.js");
const sourceDaemonEntrypoint = path.join(clientModuleDir, "daemon.ts");

function startDaemonProcess(): void {
  const useBuiltEntrypoint = existsSync(builtDaemonEntrypoint) && !clientModulePath.endsWith(".ts");
  const child = spawn(process.execPath, useBuiltEntrypoint
    ? [builtDaemonEntrypoint]
    : ["--experimental-strip-types", sourceDaemonEntrypoint], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

export async function ensureLocalDaemon(): Promise<DaemonState> {
  const existing = await readDaemonRuntime();
  if (existing?.status === "ready"
    && existing.version === ASTROGRAPH_PACKAGE_VERSION
    && existing.protocolVersion === 1) {
    return existing;
  }
  if (existing && existing.version !== ASTROGRAPH_PACKAGE_VERSION) {
    throw new Error(
      `Astrograph daemon version ${existing.version} is incompatible with ${ASTROGRAPH_PACKAGE_VERSION}; stop the old daemon before retrying`,
    );
  }

  startDaemonProcess();
  const deadline = Date.now() + DAEMON_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const state = await readDaemonRuntime();
    if (state?.status === "ready"
      && state.version === ASTROGRAPH_PACKAGE_VERSION
      && state.protocolVersion === 1) {
      return state;
    }
    await delay(DAEMON_START_RETRY_MS);
  }
  throw new Error("Timed out starting the local Astrograph daemon; run diagnostics after confirming no stale daemon record remains");
}

export async function executeDaemonCommand(
  command: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  return requestDaemon(await ensureLocalDaemon(), command, input);
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
