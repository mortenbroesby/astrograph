import { defineConfig } from "astrograph";

export default defineConfig({
  observability: {
    retentionDays: 14,
    redactSourceText: true,
  },
  performance: {
    exclude: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      ".git/**",
      ".astrograph/**",
      "pnpm-lock.yaml",
      "*.lock"
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
