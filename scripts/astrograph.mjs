#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

const distEntry = fileURLToPath(new URL("../dist/astrograph.js", import.meta.url));
const sourceEntry = fileURLToPath(new URL("../src/astrograph.ts", import.meta.url));
const preferSource =
  process.env.ASTROGRAPH_USE_SOURCE === "1"
  || process.env.ASTROGRAPH_USE_SOURCE === "true";
const useBuiltEntry = existsSync(distEntry) && (!preferSource || !existsSync(sourceEntry));
const child = spawn(
  process.execPath,
  useBuiltEntry
    ? [distEntry, ...process.argv.slice(2)]
    : ["--experimental-strip-types", sourceEntry, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: process.env,
  },
);

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
