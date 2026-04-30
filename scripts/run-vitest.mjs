import { spawnSync } from "node:child_process";

const normalizedArgs = process.argv.slice(2);

const result = spawnSync("vitest", ["run", ...normalizedArgs], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
