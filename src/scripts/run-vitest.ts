import { runProcess } from "../lib/process.ts";

const normalizedArgs = process.argv.slice(2);

const result = runProcess("vitest", ["run", ...normalizedArgs], {
  stdio: "inherit",
  shell: process.platform === "win32",
  reject: false,
});

process.exitCode = result.exitCode ?? 1;
