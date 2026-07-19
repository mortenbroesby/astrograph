import path from "node:path";
import { describe, expect, it } from "vitest";

import { packageManagerInvocation } from "../src/package-manager.ts";

describe("package-manager invocation", () => {
  it("keeps native commands as argument arrays", () => {
    expect(packageManagerInvocation("pnpm", ["add", "package with spaces"], "linux"))
      .toEqual({ command: "pnpm", args: ["add", "package with spaces"] });
  });

  it("routes Windows command shims through cmd.exe with quoted arguments", () => {
    const invocation = packageManagerInvocation("pnpm", ["add", "C:\\tmp\\package with spaces.tgz"], "win32");
    expect(path.win32.basename(invocation.command)).toBe("cmd.exe");
    expect(invocation.args.slice(0, 3)).toEqual(["/d", "/s", "/c"]);
    expect(invocation.args[3]).toMatch(/^pnpm /u);
    expect(invocation.args[3]).toContain('"C:\\tmp\\package with spaces.tgz"');
  });
});
