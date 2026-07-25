import process from "node:process";

import { describe, expect, it } from "vitest";

import { runProcess } from "../src/lib/process.ts";

describe("runProcess", () => {
  it("returns captured stdout from a successful command", () => {
    const result = runProcess(
      process.execPath,
      ["-e", "process.stdout.write('astrograph-process')"],
      { encoding: "utf8" },
    );

    expect(result.stdout).toBe("astrograph-process");
  });

  it("propagates a non-zero command failure", () => {
    expect(() => runProcess(
      process.execPath,
      ["-e", "process.stderr.write('expected failure'); process.exit(7)"],
      { encoding: "utf8" },
    )).toThrow(/expected failure/);
  });
});
