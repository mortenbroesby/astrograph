import { runProcessWithInheritedStdio } from "../lib/process.ts";

const normalizedArgs = process.argv.slice(2);

process.exitCode = runProcessWithInheritedStdio("vitest", ["run", ...normalizedArgs], {
  shell: process.platform === "win32",
});
