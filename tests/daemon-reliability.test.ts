import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

import { readDaemonRuntime } from "../src/daemon-runtime.ts";
import { MCP_TOOL_DEFINITIONS } from "../src/mcp-contract.ts";
import { ASTROGRAPH_PACKAGE_VERSION } from "../src/version.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface Bridge {
  client: Client;
  close(): Promise<void>;
}

async function openBridge(
  name: "codex" | "copilot",
  cwd: string,
  home: string,
  runtimeDir: string,
): Promise<Bridge> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--no-warnings", path.join(packageRoot, "dist", "astrograph.js"), "mcp"],
    cwd,
    stderr: "pipe",
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: path.join(home, ".config"),
      ASTROGRAPH_RUNTIME_DIR: runtimeDir,
    },
  });
  const client = new Client({ name, version: "1.0.0" });
  await client.connect(transport);
  return { client, close: () => client.close() };
}

async function call(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args }) as {
    content: Array<{ type: string; text: string }>;
  };
  return JSON.parse(result.content[0].text) as {
    ok: boolean;
    data: Record<string, any>;
  };
}

async function stopDaemon(runtimeDir: string): Promise<void> {
  const state = await readDaemonRuntime({ runtimeDir });
  if (!state) return;
  process.kill(state.pid, "SIGTERM");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (!await readDaemonRuntime({ runtimeDir })) return;
    await delay(20);
  }
  throw new Error("reliability daemon did not stop");
}

describe.sequential("Codex and Copilot daemon reliability", () => {
  it("keeps repeated concurrent stdio sessions isolated across worktrees and repositories", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "astrograph-reliability-"));
    const primary = path.join(root, "primary");
    const linked = path.join(root, "linked");
    const separate = path.join(root, "separate");
    const runtimeDir = path.join(root, "runtime");
    const runGit = (cwd: string, args: string[]) => execFileSync("git", args, { cwd, stdio: "ignore" });
    try {
      execFileSync("git", ["init", primary], { stdio: "ignore" });
      await writeFile(path.join(primary, "base.ts"), "export const sharedBase = true;\n");
      runGit(primary, ["add", "base.ts"]);
      runGit(primary, ["-c", "user.name=Astrograph Test", "-c", "user.email=astrograph@example.invalid", "commit", "-m", "initial"]);
      runGit(primary, ["worktree", "add", "-b", "reliability-linked", linked]);
      await writeFile(path.join(primary, "primary.ts"), "export function primaryOnly() { return 1; }\n");
      await writeFile(path.join(linked, "linked.ts"), "export function linkedOnly() { return 2; }\n");

      execFileSync("git", ["init", separate], { stdio: "ignore" });
      await writeFile(path.join(separate, "separate.ts"), "export function separateOnly() { return 3; }\n");

      let daemonPid: number | null = null;
      for (let round = 0; round < 2; round += 1) {
        const [codex, copilot] = await Promise.all([
          openBridge("codex", primary, path.join(root, `codex-home-${round}`), runtimeDir),
          openBridge("copilot", linked, path.join(root, `copilot-home-${round}`), runtimeDir),
        ]);
        try {
          for (const bridge of [codex, copilot]) {
            expect(bridge.client.getServerVersion()?.version).toBe(ASTROGRAPH_PACKAGE_VERSION);
            await expect(bridge.client.listTools()).resolves.toMatchObject({
              tools: expect.arrayContaining(MCP_TOOL_DEFINITIONS.map(({ name }) => expect.objectContaining({ name }))),
            });
          }

          if (round === 0) {
            const before = await Promise.all([
              call(codex.client, "get_project_status", { repoRoot: primary }),
              call(copilot.client, "get_project_status", { repoRoot: linked }),
              call(codex.client, "get_project_status", { repoRoot: separate }),
            ]);
            expect(before.every((result) => result.data.readiness.stage === "not-ready")).toBe(true);
            await Promise.all([
              call(codex.client, "index_folder", { repoRoot: primary }),
              call(copilot.client, "index_folder", { repoRoot: linked }),
              call(codex.client, "index_folder", { repoRoot: separate }),
            ]);
          }

          const [primaryResult, linkedResult, separateResult, isolatedResult] = await Promise.all([
            call(codex.client, "search_symbols", { repoRoot: primary, query: "primaryOnly" }),
            call(copilot.client, "search_symbols", { repoRoot: linked, query: "linkedOnly" }),
            call(codex.client, "search_symbols", { repoRoot: separate, query: "separateOnly" }),
            call(copilot.client, "search_symbols", { repoRoot: linked, query: "primaryOnly" }),
          ]);
          expect(primaryResult.data.items).toEqual([expect.objectContaining({ name: "primaryOnly" })]);
          expect(linkedResult.data.items).toEqual([expect.objectContaining({ name: "linkedOnly" })]);
          expect(separateResult.data.items).toEqual([expect.objectContaining({ name: "separateOnly" })]);
          expect(isolatedResult.data.items).toEqual([]);

          const statuses = await Promise.all([primary, linked, separate].map((repoRoot) =>
            call(codex.client, "get_project_status", { repoRoot })));
          expect(statuses.every((result) => result.data.readiness.discoveryReady === true)).toBe(true);
          const diagnostics = await Promise.all([primary, linked, separate].map((repoRoot) =>
            call(copilot.client, "diagnostics", { repoRoot })));
          expect(new Set(diagnostics.map((result) => result.data.storageDir)).size).toBe(3);

          const daemon = await readDaemonRuntime({ runtimeDir });
          expect(daemon).toMatchObject({ status: "ready", version: ASTROGRAPH_PACKAGE_VERSION });
          if (round === 0) daemonPid = daemon?.pid ?? null;
          else expect(daemon?.pid).toBe(daemonPid);
        } finally {
          await Promise.all([codex.close(), copilot.close()]);
        }
      }

      expect(await realpath(primary)).not.toBe(await realpath(linked));
    } finally {
      await stopDaemon(runtimeDir).catch(() => undefined);
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);
});
