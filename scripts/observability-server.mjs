#!/usr/bin/env bun

import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, open, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { encode } from "@msgpack/msgpack";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const EVENT_TOPIC = "astrograph.events";
const STORAGE_DIRNAME = ".astrograph";
const CONFIG_FILENAME = "astrograph.config.json";
const ENGINE_DISPLAY_NAME = "@astrograph";
const OBSERVABILITY_PORT_RANGE_START = 34323;
const OBSERVABILITY_PORT_RANGE_END = 35322;
const VITE_PORT_RANGE_START = 35323;
const VITE_PORT_RANGE_END = 36322;
const VITE_CONFIG_PATH = path.join(packageRoot, "observability", "vite.config.ts");
const OBSERVABILITY_DIST_DIR = path.join(packageRoot, "observability-dist");
const OBSERVABILITY_SOURCE_DIR = path.join(packageRoot, "observability");

function usage() {
  process.stderr.write(
    [
      "Usage:",
      "  ai-context-engine observability [--repo /abs/repo] [--host 127.0.0.1] [--port 34323] [--recent-limit 100] [--snapshot-interval-ms 1000] [--dev]",
    ].join("\n") + "\n",
  );
}

function parseArgs(argv) {
  const args = {
    repo: process.cwd(),
    host: null,
    port: null,
    recentLimit: null,
    snapshotIntervalMs: null,
    dev: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    if (key === "dev") {
      args.dev = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for argument --${key}`);
    }

    if (key === "repo") {
      args.repo = value;
    } else if (key === "host") {
      args.host = value;
    } else if (key === "port") {
      args.port = value;
    } else if (key === "recent-limit") {
      args.recentLimit = value;
    } else if (key === "snapshot-interval-ms") {
      args.snapshotIntervalMs = value;
    }

    index += 1;
  }

  return {
    repo: args.repo,
    host: args.host,
    port: args.port === null ? undefined : Number(args.port),
    recentLimit: args.recentLimit === null ? undefined : Number(args.recentLimit),
    snapshotIntervalMs:
      args.snapshotIntervalMs === null ? undefined : Number(args.snapshotIntervalMs),
    dev: args.dev,
  };
}

function requirePositiveInteger(value, label, allowZero = false) {
  if (!Number.isInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`${label} must be ${allowZero ? "non-negative" : "positive"}`);
  }

  return value;
}

function resolveStoragePaths(repoRoot) {
  const storageDir = path.join(repoRoot, STORAGE_DIRNAME);
  return {
    storageDir,
    eventsPath: path.join(storageDir, "events.jsonl"),
    statusPath: path.join(storageDir, "observability-server.json"),
  };
}

async function writeObservabilityStatus(paths, payload) {
  await mkdir(paths.storageDir, { recursive: true });
  await writeFile(
    paths.statusPath,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
}

async function clearObservabilityStatus(paths) {
  await rm(paths.statusPath, { force: true }).catch(() => undefined);
}

async function resolveRepoRoot(repoRoot) {
  const absoluteRepoRoot = path.resolve(repoRoot);
  const resolvedRepoRoot = await realpath(absoluteRepoRoot).catch(() => absoluteRepoRoot);

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--show-toplevel"],
      {
        cwd: resolvedRepoRoot,
      },
    );
    const worktreeRoot = stdout.trim();
    return await realpath(worktreeRoot).catch(() => worktreeRoot || resolvedRepoRoot);
  } catch {
    return resolvedRepoRoot;
  }
}

async function loadRepoConfig(repoRoot) {
  const configPath = path.join(repoRoot, CONFIG_FILENAME);
  const contents = await readFile(configPath, "utf8").catch((error) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  });

  const defaults = {
    summaryStrategy: "doc-comments-first",
    observability: {
      enabled: false,
      host: "127.0.0.1",
      port: 34323,
      recentLimit: 100,
      snapshotIntervalMs: 1000,
    },
  };

  if (contents === null) {
    return {
      ...defaults,
      configPath: null,
      repoRoot,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(
      `Invalid ${CONFIG_FILENAME}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid ${CONFIG_FILENAME}: root value must be an object`);
  }

  const observability = parsed.observability;
  if (
    observability !== undefined
    && (observability === null || typeof observability !== "object" || Array.isArray(observability))
  ) {
    throw new Error(`Invalid ${CONFIG_FILENAME}: observability must be an object`);
  }

  const merged = {
    ...defaults,
    configPath,
    repoRoot,
    summaryStrategy:
      parsed.summaryStrategy === undefined
        ? defaults.summaryStrategy
        : parsed.summaryStrategy,
    observability: {
      ...defaults.observability,
      ...(observability ?? {}),
    },
  };

  if (
    merged.summaryStrategy !== "doc-comments-first"
    && merged.summaryStrategy !== "signature-only"
  ) {
    throw new Error(`Invalid ${CONFIG_FILENAME}: summaryStrategy must be a supported value`);
  }
  if (typeof merged.observability.enabled !== "boolean") {
    throw new Error(`Invalid ${CONFIG_FILENAME}: observability.enabled must be a boolean`);
  }
  if (typeof merged.observability.host !== "string" || merged.observability.host.length === 0) {
    throw new Error(`Invalid ${CONFIG_FILENAME}: observability.host must be a non-empty string`);
  }
  if (!Number.isInteger(merged.observability.port) || merged.observability.port < 0) {
    throw new Error(`Invalid ${CONFIG_FILENAME}: observability.port must be a non-negative integer`);
  }
  if (!Number.isInteger(merged.observability.recentLimit) || merged.observability.recentLimit <= 0) {
    throw new Error(`Invalid ${CONFIG_FILENAME}: observability.recentLimit must be a positive integer`);
  }
  if (
    !Number.isInteger(merged.observability.snapshotIntervalMs)
    || merged.observability.snapshotIntervalMs <= 0
  ) {
    throw new Error(`Invalid ${CONFIG_FILENAME}: observability.snapshotIntervalMs must be a positive integer`);
  }

  return merged;
}

async function probePort(host, port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(port, host, () => {
      const address = server.address();
      const resolvedPort =
        typeof address === "object" && address ? address.port : undefined;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        if (!resolvedPort) {
          reject(new Error("Failed to resolve an available port"));
          return;
        }
        resolve(resolvedPort);
      });
    });
  });
}

function isAddressInUseError(error) {
  return Boolean(error) && typeof error === "object" && "code" in error && error.code === "EADDRINUSE";
}

async function resolvePort(host, requestedPort, rangeStart, rangeEnd) {
  if (requestedPort !== 0) {
    try {
      return await probePort(host, requestedPort);
    } catch (error) {
      if (!isAddressInUseError(error)) {
        throw error;
      }
    }
  }

  const candidatePorts = [];
  if (requestedPort >= rangeStart && requestedPort <= rangeEnd) {
    candidatePorts.push(requestedPort);
  }
  for (let port = rangeStart; port <= rangeEnd; port += 1) {
    if (port !== requestedPort) {
      candidatePorts.push(port);
    }
  }

  for (const port of candidatePorts) {
    try {
      return await probePort(host, port);
    } catch (error) {
      if (isAddressInUseError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`No available port found in ${rangeStart}-${rangeEnd}`);
}

function createHealthEvent(snapshot) {
  return {
    staleStatus: snapshot.staleStatus,
    freshnessMode: snapshot.freshnessMode,
    indexedFiles: snapshot.indexedFiles,
    indexedSymbols: snapshot.indexedSymbols,
    currentFiles: snapshot.currentFiles,
    changedFiles: snapshot.changedFiles,
    missingFiles: snapshot.missingFiles,
    extraFiles: snapshot.extraFiles,
    watch: snapshot.watch,
  };
}

function buildEventEnvelope({ repoRoot, source, event, level, correlationId, data }) {
  return {
    id: randomUUID(),
    ts: new Date().toISOString(),
    repoRoot,
    source,
    event,
    level,
    correlationId,
    data: data ?? {},
  };
}

async function appendLocalEvent(eventsPath, input) {
  const envelope = buildEventEnvelope(input);
  await mkdir(path.dirname(eventsPath), { recursive: true });
  await appendFile(eventsPath, `${JSON.stringify(envelope)}\n`, "utf8");
  return envelope;
}

async function readRecentEvents(eventsPath, limit) {
  const contents = await readFile(eventsPath, "utf8").catch(() => "");
  if (contents.trim() === "") {
    return [];
  }

  return contents
    .trimEnd()
    .split("\n")
    .slice(-limit)
    .map((line) => JSON.parse(line));
}

function resolveNodeExecutable() {
  const explicit = process.env.AI_CONTEXT_ENGINE_NODE_BIN;
  if (explicit && explicit.trim() !== "") {
    return explicit;
  }

  return "node";
}

async function runDiagnostics(repoRoot) {
  const nodeExecutable = resolveNodeExecutable();
  const wrapperPath = path.join(packageRoot, "scripts", "ai-context-engine.mjs");
  const { stdout } = await execFileAsync(
    nodeExecutable,
    [wrapperPath, "cli", "diagnostics", "--repo", repoRoot],
    {
      cwd: packageRoot,
      env: process.env,
      maxBuffer: 1024 * 1024 * 4,
    },
  );

  return JSON.parse(stdout);
}

function wantsMsgpack(req, url) {
  if (url.searchParams.get("format") === "msgpack") {
    return true;
  }

  const accept = req.headers.get("accept") ?? "";
  return accept.includes("application/msgpack");
}

function createProtocolResponse(data, useMsgpack) {
  if (useMsgpack) {
    return new Response(Buffer.from(encode(data)), {
      headers: {
        "content-type": "application/msgpack",
      },
    });
  }

  return Response.json(data);
}

function socketEncodingFromRequest(url) {
  return url.searchParams.get("encoding") === "msgpack" ? "msgpack" : "json";
}

function sendSocketPayload(ws, encoding, payload) {
  if (encoding === "msgpack") {
    ws.send(Buffer.from(encode(payload)), true);
    return;
  }

  ws.send(JSON.stringify(payload));
}

function getMimeType(filePath) {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  if (filePath.endsWith(".svg")) {
    return "image/svg+xml";
  }
  return "application/octet-stream";
}

function reactRefreshPreamble(viteOrigin) {
  return `<script type="module">
import RefreshRuntime from '${viteOrigin}/@react-refresh'
RefreshRuntime.injectIntoGlobalHook(window)
window.$RefreshReg$ = () => {}
window.$RefreshSig$ = () => (type) => type
window.__vite_plugin_react_preamble_installed__ = true
</script>`;
}

function renderDevShell(viteOrigin) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${ENGINE_DISPLAY_NAME} observability</title>
    ${reactRefreshPreamble(viteOrigin)}
    <script type="module" src="${viteOrigin}/@vite/client"></script>
    <script type="module" src="${viteOrigin}/src/main.tsx"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}

async function startViteDevServer(input) {
  const port = await resolvePort(
    input.host,
    0,
    VITE_PORT_RANGE_START,
    VITE_PORT_RANGE_END,
  );

  const child = spawn(
    "pnpm",
    [
      "exec",
      "vite",
      "--config",
      VITE_CONFIG_PATH,
      "--host",
      input.host,
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: packageRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });

  const origin = `http://${input.host}:${port}`;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15_000) {
    if (child.exitCode !== null) {
      throw new Error(stderr || stdout || "Vite dev server exited early");
    }

    try {
      const response = await fetch(`${origin}/@vite/client`);
      if (response.ok) {
        return {
          child,
          origin,
        };
      }
    } catch {
      // keep polling
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  child.kill("SIGTERM");
  throw new Error("Timed out waiting for Vite dev server");
}

async function readBuiltViewerIndex() {
  return await readFile(path.join(OBSERVABILITY_DIST_DIR, "index.html"), "utf8");
}

function shouldServeSpa(urlPathname) {
  return urlPathname === "/" || urlPathname === "/health/view";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = await resolveRepoRoot(args.repo);
  const repoConfig = await loadRepoConfig(repoRoot);
  const host = args.host ?? repoConfig.observability.host;
  const port = args.port ?? repoConfig.observability.port;
  const recentLimit = args.recentLimit ?? repoConfig.observability.recentLimit;
  const snapshotIntervalMs =
    args.snapshotIntervalMs ?? repoConfig.observability.snapshotIntervalMs;
  requirePositiveInteger(recentLimit, "recentLimit");
  requirePositiveInteger(snapshotIntervalMs, "snapshotIntervalMs");
  requirePositiveInteger(port, "port", true);
  const resolvedPort = await resolvePort(
    host,
    port,
    OBSERVABILITY_PORT_RANGE_START,
    OBSERVABILITY_PORT_RANGE_END,
  );

  const hasBuiltViewer = await stat(path.join(OBSERVABILITY_DIST_DIR, "index.html"))
    .then(() => true)
    .catch(() => false);
  const hasViewerSource = await stat(path.join(OBSERVABILITY_SOURCE_DIR, "index.html"))
    .then(() => true)
    .catch(() => false);

  const devMode = args.dev || (!hasBuiltViewer && hasViewerSource);
  const viteDev = devMode
    ? await startViteDevServer({ host })
    : null;
  const builtViewerIndex = !devMode ? await readBuiltViewerIndex() : null;

  const paths = resolveStoragePaths(repoRoot);
  let recentEvents = await readRecentEvents(paths.eventsPath, recentLimit);
  let readOffset = await stat(paths.eventsPath).then((entry) => entry.size).catch(() => 0);
  let pendingFragment = "";
  let connectedClients = 0;
  let lastHealthSnapshotId = "";
  let tailInFlight = false;
  let healthInFlight = false;
  const activeSockets = new Set();

  function pushRecentEvent(event) {
    recentEvents.push(event);
    if (recentEvents.length > recentLimit) {
      recentEvents = recentEvents.slice(-recentLimit);
    }
  }

  async function publishHealthSnapshot(server, reason) {
    if (healthInFlight) {
      return null;
    }

    healthInFlight = true;
    try {
      const snapshot = await runDiagnostics(repoRoot);
      const envelope = await appendLocalEvent(paths.eventsPath, {
        repoRoot,
        source: "health",
        event: "health.snapshot",
        level: "debug",
        data: {
          reason,
          ...createHealthEvent(snapshot),
        },
      });
      lastHealthSnapshotId = envelope.id;
      return snapshot;
    } finally {
      healthInFlight = false;
    }
  }

  async function drainEventFile(server) {
    if (tailInFlight) {
      return;
    }
    tailInFlight = true;

    try {
      const nextStat = await stat(paths.eventsPath).catch(() => null);
      if (!nextStat) {
        return;
      }

      if (nextStat.size < readOffset) {
        readOffset = 0;
        pendingFragment = "";
        recentEvents = [];
      }

      if (nextStat.size === readOffset) {
        return;
      }

      const length = nextStat.size - readOffset;
      const handle = await open(paths.eventsPath, "r");

      try {
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, readOffset);
        readOffset = nextStat.size;

        const chunk = pendingFragment + buffer.toString("utf8");
        const lines = chunk.split("\n");
        pendingFragment = lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim() === "") {
            continue;
          }
          const event = JSON.parse(line);
          if (event.id === lastHealthSnapshotId) {
            lastHealthSnapshotId = "";
          }
          pushRecentEvent(event);
          for (const ws of activeSockets) {
            sendSocketPayload(ws, ws.data.encoding, { type: "event", event });
          }
        }
      } finally {
        await handle.close();
      }
    } finally {
      tailInFlight = false;
    }
  }

  const server = Bun.serve({
    hostname: host,
    port: resolvedPort,
    async fetch(req, bunServer) {
      const url = new URL(req.url);

      if (url.pathname === "/events") {
        const success = bunServer.upgrade(req, {
          data: {
            encoding: socketEncodingFromRequest(url),
          },
        });
        return success ? undefined : new Response("WebSocket upgrade failed", { status: 500 });
      }

      if (url.pathname === "/health") {
        try {
          const snapshot = await runDiagnostics(repoRoot);
          return createProtocolResponse(snapshot, wantsMsgpack(req, url));
        } catch (error) {
          return Response.json(
            {
              error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
          );
        }
      }

      if (url.pathname === "/recent") {
        return createProtocolResponse(
          {
            repoRoot,
            events: recentEvents,
          },
          wantsMsgpack(req, url),
        );
      }

      if (!devMode && url.pathname.startsWith("/assets/")) {
        const assetPath = path.join(OBSERVABILITY_DIST_DIR, url.pathname.slice(1));
        const asset = await readFile(assetPath).catch(() => null);
        if (asset) {
          return new Response(asset, {
            headers: {
              "content-type": getMimeType(assetPath),
            },
          });
        }
      }

      if (shouldServeSpa(url.pathname)) {
        if (devMode && viteDev) {
          return new Response(renderDevShell(viteDev.origin), {
            headers: {
              "content-type": "text/html; charset=utf-8",
            },
          });
        }

        if (builtViewerIndex) {
          return new Response(builtViewerIndex, {
            headers: {
              "content-type": "text/html; charset=utf-8",
            },
          });
        }
      }

      return Response.json({
        repoRoot,
        endpoints: ["/", "/health/view", "/health", "/recent", "/events"],
        devMode,
        viteOrigin: viteDev?.origin ?? null,
      });
    },
    websocket: {
      open(ws) {
        connectedClients += 1;
        activeSockets.add(ws);
        ws.subscribe(EVENT_TOPIC);

        void (async () => {
          try {
            const snapshot = await runDiagnostics(repoRoot);
            sendSocketPayload(ws, ws.data.encoding, {
              type: "snapshot",
              snapshot,
            });
            sendSocketPayload(ws, ws.data.encoding, {
              type: "recent",
              events: recentEvents,
            });
          } catch (error) {
            sendSocketPayload(ws, ws.data.encoding, {
              type: "error",
              message: error instanceof Error ? error.message : String(error),
            });
          }
        })();
      },
      message() {
        // Read-only channel.
      },
      close(ws) {
        connectedClients = Math.max(0, connectedClients - 1);
        activeSockets.delete(ws);
      },
      error() {
        // Best-effort debug surface only.
      },
    },
  });

  process.stdout.write(`${JSON.stringify({
    host: server.hostname,
    port: server.port,
    repoRoot,
    devMode,
    viteOrigin: viteDev?.origin ?? null,
  })}\n`);

  await writeObservabilityStatus(paths, {
    host: server.hostname,
    port: server.port,
    repoRoot,
    pid: process.pid,
    devMode,
    viteOrigin: viteDev?.origin ?? null,
    startedAt: new Date().toISOString(),
  });

  await publishHealthSnapshot(server, "startup").catch(() => null);
  await drainEventFile(server);

  const tailInterval = setInterval(() => {
    void drainEventFile(server);
  }, 150);
  const snapshotInterval = setInterval(() => {
    if (connectedClients === 0) {
      return;
    }
    void publishHealthSnapshot(server, "interval");
  }, snapshotIntervalMs);

  const shutdown = () => {
    clearInterval(tailInterval);
    clearInterval(snapshotInterval);
    viteDev?.child.kill("SIGTERM");
    void clearObservabilityStatus(paths);
    server.stop(true);
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
