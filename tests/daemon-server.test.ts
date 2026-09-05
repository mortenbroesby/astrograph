import { connect } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DAEMON_PROTOCOL_VERSION, encodeDaemonMessage } from "../src/daemon-protocol.ts";
import { DAEMON_HANDOFF_TIMEOUT_MS, reconcileLocalDaemon, requestDaemon } from "../src/daemon-client.ts";
import { readDaemonRuntime } from "../src/daemon-runtime.ts";
import { startDaemonServer, type DaemonServer } from "../src/daemon-server.ts";

const runtimeDirs: string[] = [];
const servers: DaemonServer[] = [];

async function createRuntimeDir() {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), "astrograph-daemon-server-"));
  runtimeDirs.push(runtimeDir);
  return runtimeDir;
}

async function request(endpoint: string, message: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = connect(endpoint);
    let response = "";
    socket.setEncoding("utf8");
    socket.on("connect", () => socket.write(encodeDaemonMessage(message as never)));
    socket.on("data", (chunk: string) => {
      response += chunk;
      if (response.includes("\n")) {
        socket.end();
        resolve(JSON.parse(response));
      }
    });
    socket.on("error", reject);
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(runtimeDirs.splice(0).map((runtimeDir) =>
    rm(runtimeDir, { recursive: true, force: true }),
  ));
});

describe("daemon server", () => {
  it("serves only capability-authenticated local requests", async () => {
    const runtimeDir = await createRuntimeDir();
    const server = await startDaemonServer({
      runtimeDir,
      token: "a".repeat(32),
      dispatch: async (command, input) => ({ command, input }),
    });
    servers.push(server);

    await expect(request(server.state.endpoint, {
      protocolVersion: DAEMON_PROTOCOL_VERSION,
      id: "bad-token",
      token: "b".repeat(32),
      command: "search_symbols",
      input: {},
    })).resolves.toMatchObject({ ok: false, error: { code: "unauthorized" } });

    await expect(request(server.state.endpoint, {
      protocolVersion: DAEMON_PROTOCOL_VERSION,
      id: "good-token",
      token: "a".repeat(32),
      command: "search_symbols",
      input: { repoRoot: "/repo" },
    })).resolves.toEqual({
      protocolVersion: DAEMON_PROTOCOL_VERSION,
      id: "good-token",
      ok: true,
      data: { command: "search_symbols", input: { repoRoot: "/repo" } },
    });

    await expect(requestDaemon(server.state, "search_symbols", { repoRoot: "/repo" })).resolves.toEqual({
      command: "search_symbols",
      input: { repoRoot: "/repo" },
    });
  });

  it("replaces only an authenticated incompatible daemon", async () => {
    const runtimeDir = await createRuntimeDir();
    let shutdowns = 0;
    let server: DaemonServer;
    server = await startDaemonServer({
      runtimeDir,
      version: "previous-version",
      dispatch: async () => ({}),
      onShutdown: () => {
        shutdowns += 1;
        return server.close();
      },
    });
    servers.push(server);

    await expect(Promise.all([
      reconcileLocalDaemon({ runtimeDir }),
      reconcileLocalDaemon({ runtimeDir }),
    ])).resolves.toEqual([undefined, undefined]);
    expect(shutdowns).toBe(1);
    await expect(readDaemonRuntime({ runtimeDir })).resolves.toBeNull();
  });

  it("does not kill an incompatible daemon that cannot confirm shutdown", async () => {
    const runtimeDir = await createRuntimeDir();
    const server = await startDaemonServer({
      runtimeDir,
      version: "previous-version",
      dispatch: async () => ({}),
    });
    servers.push(server);

    const startedAt = Date.now();
    await expect(reconcileLocalDaemon({ runtimeDir })).rejects.toThrow("close the older Astrograph client once");
    expect(Date.now() - startedAt).toBeLessThan(DAEMON_HANDOFF_TIMEOUT_MS);
    await expect(readDaemonRuntime({ runtimeDir })).resolves.toMatchObject({ pid: process.pid });
  });
});
