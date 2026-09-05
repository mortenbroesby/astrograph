import { describe, expect, it } from "vitest";

import { compareGenericPackageVersions, parseRuntimeAstrographVersion } from "../src/version.ts";

describe("generic package version comparison", () => {
  it("reads release parts from an immutable snapshot version", () => {
    expect(parseRuntimeAstrographVersion("0.13.0-alpha.230.snapshot.33977601352.g2a0f9870dd85"))
      .toEqual({ major: 0, minor: 13, patch: 0, increment: 230 });
    expect(() => parseRuntimeAstrographVersion("0.13.0-alpha.230.snapshot.latest.g2a0f9870dd85"))
      .toThrow("Invalid Astrograph version");
  });

  it("orders numeric prerelease identifiers semantically", () => {
    expect(compareGenericPackageVersions("1.0.0-rc.10", "1.0.0-rc.2")).toBeGreaterThan(0);
  });

  it("keeps stable versions newer than their prerelease", () => {
    expect(compareGenericPackageVersions("1.0.0", "1.0.0-rc.10")).toBeGreaterThan(0);
  });

  it("rejects invalid generic versions without coercion", () => {
    expect(compareGenericPackageVersions("not-a-version", "1.0.0")).toBeNull();
  });
});
