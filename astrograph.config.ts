import type { RepoEngineConfig } from "./src/types/config.ts";

export default {
  observability: {
    retentionDays: 14,
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
} satisfies RepoEngineConfig;
