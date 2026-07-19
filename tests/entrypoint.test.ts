import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { isMainModule } from "../src/entrypoint.ts";

describe("ESM entrypoint detection", () => {
  it("compares module URLs against a native argv path", () => {
    const entrypoint = path.resolve("src", "cli.ts");

    expect(isMainModule(pathToFileURL(entrypoint).href, entrypoint)).toBe(true);
    expect(isMainModule(pathToFileURL(entrypoint).href, path.resolve("src", "mcp.ts"))).toBe(false);
  });
});
