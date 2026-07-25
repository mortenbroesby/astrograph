import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const selectedScripts = [
  "src/scripts/run-vitest.ts",
  "src/scripts/release-agent.ts",
  "src/scripts/install.ts",
];

describe("process seam adoption", () => {
  it.each(selectedScripts)("routes %s through the internal process seam", (scriptPath) => {
    const source = readFileSync(path.join(packageRoot, scriptPath), "utf8");

    expect(source).not.toMatch(/from ["']node:child_process["']/);
    expect(source).toContain('from "../lib/process.ts"');
  });
});
