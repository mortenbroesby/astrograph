import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { appendEngineEvent } from "../src/index.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8")) as { version: string };

afterEach(cleanupFixtureRepos);

describe("astrograph command help", () => {
  it("shows the installed version without starting setup", () => {
    const result = spawnSync(process.execPath, ["./src/astrograph.ts"], {
      cwd: packageRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Astrograph v${version}`);
    expect(result.stderr).toContain("Usage:");
  });

  it("prints the repository report through the public command", async () => {
    const repoRoot = await createFixtureRepo();
    await appendEngineEvent({ repoRoot, source: "mcp", event: "mcp.tool.finished", level: "info", data: {} });

    const result = spawnSync(process.execPath, ["--import=tsx", "./src/astrograph.ts", "report", "--repo", repoRoot], {
      cwd: packageRoot,
      encoding: "utf8",
      env: { ...process.env, ASTROGRAPH_USE_SOURCE: "1" },
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ scope: "repository", eventCount: 1 });
  });
});
