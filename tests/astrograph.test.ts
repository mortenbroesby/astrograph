import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8")) as { version: string };

describe("astrograph command help", () => {
  it("identifies the installed version", () => {
    const result = spawnSync(process.execPath, ["--import=tsx", "./src/astrograph.ts", "--help"], {
      cwd: packageRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Astrograph v${version}`);
  });
});
