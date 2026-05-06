import { afterEach, describe, expect, it } from "vitest";

import {
  getSupportedMcpProfiles,
  resolveMcpProfileFromArgs,
} from "../src/mcp.ts";

describe("mcp profile resolution", () => {
  const originalProfileEnv = process.env.ASTROGRAPH_MCP_PROFILE;

  afterEach(() => {
    if (originalProfileEnv === undefined) {
      delete process.env.ASTROGRAPH_MCP_PROFILE;
      return;
    }

    process.env.ASTROGRAPH_MCP_PROFILE = originalProfileEnv;
  });

  it("defaults to full when no profile is provided", () => {
    expect(resolveMcpProfileFromArgs([])).toBe("full");
  });

  it("accepts --mcp-profile argument", () => {
    expect(resolveMcpProfileFromArgs(["--mcp-profile", "core"]))
      .toBe("core");
  });

  it("accepts --mcp-profile=value argument", () => {
    expect(resolveMcpProfileFromArgs(["--mcp-profile=standard"]))
      .toBe("standard");
  });

  it("throws on unsupported profile env values", () => {
    process.env.ASTROGRAPH_MCP_PROFILE = "n/a";
    expect(() => resolveMcpProfileFromArgs([]))
      .toThrow(
        `Unsupported --mcp-profile: n/a. Expected one of: ${getSupportedMcpProfiles().join(", ")}`,
      );
  });

  it("supports ASTROGRAPH_MCP_PROFILE when valid", () => {
    process.env.ASTROGRAPH_MCP_PROFILE = "standard";
    expect(resolveMcpProfileFromArgs([])).toBe("standard");
  });

  it("throws on unsupported CLI profile input", () => {
    expect(() => resolveMcpProfileFromArgs(["--mcp-profile", "barebones"]))
      .toThrow(
        `Unsupported --mcp-profile: barebones. Expected one of: ${getSupportedMcpProfiles().join(", ")}`,
      );
  });
});
