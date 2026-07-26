import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
    mcp: "src/mcp.ts",
    daemon: "src/daemon.ts",
    astrograph: "src/astrograph.ts",
    "scripts/install": "src/scripts/install.ts",
    "scripts/git-smart-refresh": "src/scripts/git-smart-refresh.ts",
    "workers/analyze-file-worker": "src/workers/analyze-file-worker.ts",
  },
  format: "esm",
  target: "node22",
  outDir: "dist",
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  sourcemap: true,
  dts: true,
});
