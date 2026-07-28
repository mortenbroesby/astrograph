import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8")) as { version: string };

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
});
