import { defineConfig } from "astrograph";

export default defineConfig({
  summaryStrategy: "doc-comments-first",
  storageMode: "wal",

  observability: {
    enabled: true,
    retentionDays: 14,
    recentLimit: 50,
    snapshotIntervalMs: 250,
    redactSourceText: false,
  },

  ranking: {
    exactName: 1000,
    exactQualifiedName: 900,
    prefixName: 700,
    prefixQualifiedName: 650,
    containsName: 500,
    containsQualifiedName: 450,
    signatureContains: 250,
    summaryContains: 200,
    filePathContains: 120,
    exactWord: 180,
    tokenMatch: 70,
    exportedBonus: 20,
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

  watch: {
    backend: "auto",
    debounceMs: 100,
  },

  limits: {
    maxFilesDiscovered: 100000,
    maxFileBytes: 250000,
    maxSymbolsPerFile: 2000,
    maxSymbolResults: 100,
    maxTextResults: 100,
    maxLiveSearchMatches: 100,
    maxChildProcessOutputBytes: 1000000,
  },
});
