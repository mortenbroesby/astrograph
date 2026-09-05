import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertPackageIdentity,
  parseSmokePackageArgs,
} from "../src/scripts/smoke-package-bin.ts";

describe("package smoke arguments", () => {
  it("resolves a supplied tarball without changing the other modes", () => {
    expect(parseSmokePackageArgs(
      ["--prebuilt", "--tarball", "artifacts/astrograph.tgz", "--wasm-only"],
      "/workspace",
    )).toEqual({
      prebuiltPackage: true,
      tarballPath: path.resolve("/workspace/artifacts/astrograph.tgz"),
      wasmOnly: true,
    });
  });

  it.each([
    [["--tarball"], "requires a .tgz path"],
    [["--tarball="], "requires a .tgz path"],
    [["--tarball", "artifact.zip"], "requires a .tgz path"],
    [["--unknown"], "Unknown package smoke argument"],
  ] as const)("rejects invalid arguments %j", (args, message) => {
    expect(() => parseSmokePackageArgs(args)).toThrow(message);
  });
});

describe("package smoke identity", () => {
  it("accepts the expected package name and version", () => {
    expect(() => assertPackageIdentity(
      { name: "astrograph", version: "1.2.3-snapshot.4.abc" },
      { name: "astrograph", version: "1.2.3-snapshot.4.abc" },
    )).not.toThrow();
  });

  it.each([
    [{ name: "other", version: "1.2.3" }, "astrograph@1.2.3"],
    [{ name: "astrograph", version: "1.2.4" }, "astrograph@1.2.3"],
  ])("rejects a mismatched installed manifest", (actual, expected) => {
    expect(() => assertPackageIdentity(
      actual,
      { name: "astrograph", version: "1.2.3" },
    )).toThrow(expected);
  });
});
