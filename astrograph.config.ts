import { defineConfig } from "astrograph";

export default defineConfig({
  observability: {
    enabled: true,
    retentionDays: 14,
    recentLimit: 50,
    snapshotIntervalMs: 250,
    redactSourceText: false,
  },

  performance: {
    exclude: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      ".git/**",
      ".astrograph/**",
      "pnpm-lock.yaml",
      "*.lock",
    ],
    fileProcessingConcurrency: "auto",
    workerPool: {
      enabled: true,
      maxWorkers: "auto",
    },
  },

  limits: {
    maxSymbolResults: 100,
  },
});
