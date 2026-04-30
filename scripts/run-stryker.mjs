import { spawn } from "node:child_process";

const configFile = process.argv[2];

if (!configFile) {
  process.stderr.write("Expected a Stryker config file argument.\n");
  process.exit(1);
}

const child = spawn("pnpm", ["exec", "stryker", "run", configFile], {
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
