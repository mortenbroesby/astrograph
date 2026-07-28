#!/usr/bin/env node

import process from "node:process";

import { getCommandByMcpToolName } from "./command-registry.ts";
import { isMainModule } from "./entrypoint.ts";
import { clearStorageProcessCaches } from "./storage.ts";
import { startDaemonServer } from "./daemon-server.ts";
import { createDaemonTenantManager } from "./daemon-tenants.ts";
import { disposeTokenizer } from "./tokenizer.ts";

process.env.ASTROGRAPH_DAEMON_PROCESS = "1";

type EngineModule = typeof import("./index.ts");

const DAEMON_IDLE_TIMEOUT_MS = 5 * 60_000;
const DAEMON_IDLE_CHECK_INTERVAL_MS = 1_000;

let engineModulePromise: Promise<EngineModule> | null = null;

function loadEngineModule(): Promise<EngineModule> {
  engineModulePromise ??= import("./index.ts");
  return engineModulePromise;
}

async function main(): Promise<void> {
  let lastActivityAt = Date.now();
  const tenants = createDaemonTenantManager();
  const server = await startDaemonServer({
    async dispatch(command, input) {
      lastActivityAt = Date.now();
      try {
        const registryEntry = getCommandByMcpToolName(command);
        if (!registryEntry) {
          throw new Error(`Unsupported daemon command: ${command}`);
        }
        const execute = async () => {
          const result = await registryEntry.execute(await loadEngineModule(), input as never);
          if (command === "index_folder" && typeof input.repoRoot === "string") {
            await tenants.watchIndexedRepository({
              repoRoot: input.repoRoot,
              summaryStrategy: typeof input.summaryStrategy === "string"
                ? input.summaryStrategy as never
                : undefined,
            }, result as never);
          }
          return result;
        };
        return typeof input.repoRoot === "string"
          ? tenants.runForRepository(input.repoRoot, execute)
          : execute();
      } finally {
        lastActivityAt = Date.now();
      }
    },
  });

  let closing: Promise<void> | null = null;
  const close = () => {
    closing ??= (async () => {
      await server.close();
      await tenants.close();
      clearStorageProcessCaches();
      disposeTokenizer();
      clearInterval(idleTimer);
    })();
    return closing;
  };
  process.once("SIGINT", () => void close());
  process.once("SIGTERM", () => void close());
  const idleTimer = setInterval(() => {
    if (Date.now() - lastActivityAt >= DAEMON_IDLE_TIMEOUT_MS) {
      void close();
    }
  }, DAEMON_IDLE_CHECK_INTERVAL_MS);
}

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
