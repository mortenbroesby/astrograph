import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("../src/scripts/global-install-message.mjs", import.meta.url),
);

function runPostInstall(environment: Record<string, string | undefined>): string {
  return execFileSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
}

describe("global package installation message", () => {
  it("welcomes a global npm install with the version and next command", () => {
    const output = runPostInstall({ npm_config_global: "true", npm_config_location: undefined });

    expect(output).toMatch(/Astrograph v\d+\.\d+\.\d+-alpha\.\d+ installed globally\./);
    expect(output).toContain("astrograph install --global --ide codex");
    expect(output).toContain("astrograph install --global --ide copilot-cli");
  });

  it("stays silent for local dependency installation", () => {
    expect(runPostInstall({ npm_config_global: "false", npm_config_location: "project" })).toBe("");
  });
});
