import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

describe("release agent arguments", () => {
  it("rejects force-patch without apply before reading release state", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "./src/scripts/release-agent.ts",
        "--force-patch",
      ],
      {
        cwd: packageRoot,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--force-patch requires --apply");
  }, 30_000);
});
