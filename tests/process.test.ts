import { describe, expect, it } from "vitest";

import { captureProcess, runProcessWithInheritedStdio } from "../src/lib/process.ts";

describe("process wrapper", () => {
  it("captures stdout while allowing callers to suppress stderr", () => {
    expect(captureProcess(
      process.execPath,
      ["-e", "process.stdout.write('captured'); process.stderr.write('ignored')"],
      { stderr: "ignore" },
    )).toBe("captured");
  });

  it("returns a non-zero exit code for inherited-stdio commands", () => {
    expect(runProcessWithInheritedStdio(
      process.execPath,
      ["-e", "process.exit(7)"],
    )).toBe(7);
  });
});
