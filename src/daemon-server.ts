import { createServer, type Server, type Socket } from "node:net";
import { rm } from "node:fs/promises";

import {
  MAX_DAEMON_MESSAGE_BYTES,
  daemonFailure,
  encodeDaemonMessage,
  parseDaemonRequest,
} from "./daemon-protocol.ts";
import {
  claimDaemonRuntime,
  markDaemonReady,
  releaseDaemonRuntime,
  type DaemonRuntimeOptions,
  type DaemonState,
} from "./daemon-runtime.ts";

export interface DaemonServer {
  state: DaemonState;
  close(): Promise<void>;
}

export interface DaemonServerOptions extends DaemonRuntimeOptions {
  dispatch(command: string, input: Record<string, unknown>): Promise<unknown>;
  onShutdown?(): Promise<void> | void;
}

function write(socket: Socket, message: ReturnType<typeof daemonFailure> | {
  protocolVersion: 1;
  id: string;
  ok: true;
  data: unknown;
}): void {
  socket.write(encodeDaemonMessage(message));
}

function attachSocket(socket: Socket, state: DaemonState, options: DaemonServerOptions): void {
  let buffered = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk: string) => {
    buffered += chunk;
    if (Buffer.byteLength(buffered, "utf8") > MAX_DAEMON_MESSAGE_BYTES) {
      write(socket, daemonFailure("invalid_request", "Daemon message exceeds maximum size"));
      socket.destroy();
      return;
    }

    let delimiter = buffered.indexOf("\n");
    while (delimiter >= 0) {
      const line = buffered.slice(0, delimiter);
      buffered = buffered.slice(delimiter + 1);
      delimiter = buffered.indexOf("\n");
      let request;
      try {
        request = parseDaemonRequest(line);
      } catch (error) {
        write(socket, daemonFailure(
          String(error).includes("protocol version") ? "unsupported_version" : "invalid_request",
          error instanceof Error ? error.message : "Invalid daemon request",
        ));
        continue;
      }
      if (request.token !== state.token) {
        write(socket, daemonFailure("unauthorized", "Invalid daemon capability", request.id));
        continue;
      }
      if (request.command === "__shutdown") {
        if (!options.onShutdown) {
          write(socket, daemonFailure("command_failed", "Daemon shutdown is unavailable", request.id));
          continue;
        }
        write(socket, { protocolVersion: 1, id: request.id, ok: true, data: { shuttingDown: true } });
        socket.end();
        queueMicrotask(() => void Promise.resolve(options.onShutdown!()).catch(() => undefined));
        continue;
      }
      void options.dispatch(request.command, request.input).then((data) => {
        write(socket, { protocolVersion: 1, id: request.id, ok: true, data });
      }, (error: unknown) => {
        write(socket, daemonFailure(
          "command_failed",
          error instanceof Error ? error.message : "Daemon command failed",
          request.id,
        ));
      });
    }
  });
}

function listen(server: Server, endpoint: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(endpoint, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

export async function startDaemonServer(options: DaemonServerOptions): Promise<DaemonServer> {
  const claim = await claimDaemonRuntime(options);
  if (claim.kind === "occupied") {
    throw new Error("An Astrograph daemon is already running");
  }
  if (claim.kind === "invalid") {
    throw new Error("Astrograph daemon state is invalid; remove the runtime record after confirming no daemon is running");
  }

  if (!claim.state.endpoint.startsWith("\\\\.\\pipe\\")) {
    await rm(claim.state.endpoint, { force: true }).catch(() => undefined);
  }
  const server = createServer((socket) => attachSocket(socket, claim.state, options));
  try {
    await listen(server, claim.state.endpoint);
    const state = await markDaemonReady(claim);
    let closed = false;
    return {
      state,
      async close() {
        if (closed) {
          return;
        }
        closed = true;
        await closeServer(server);
        if (!state.endpoint.startsWith("\\\\.\\pipe\\")) {
          await rm(state.endpoint, { force: true }).catch(() => undefined);
        }
        await releaseDaemonRuntime(claim);
      },
    };
  } catch (error) {
    await closeServer(server).catch(() => undefined);
    await releaseDaemonRuntime(claim);
    throw error;
  }
}
