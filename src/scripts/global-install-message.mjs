import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const packageVersion = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8")).version;

export function isGlobalNpmInstall(environment = process.env) {
  return environment.npm_config_global === "true" || environment.npm_config_location === "global";
}

export function formatGlobalInstallMessage(version = packageVersion) {
  return [
    "",
    `Astrograph v${version} installed globally.`,
    "",
    "Next, choose the AI client you want to connect:",
    "  astrograph install --global --ide codex",
    "  astrograph install --global --ide copilot-cli",
    "",
    "That gives every repository its own private local index—no project setup required.",
    "",
  ].join("\n");
}

if (isGlobalNpmInstall()) {
  process.stdout.write(formatGlobalInstallMessage());
}
