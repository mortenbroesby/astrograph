# Config Reference

Astrograph reads optional repository defaults from `astrograph.config.ts`.

Use config when you want to tune retrieval behavior, indexing scope,
observability, watch behavior, or safety limits for one repository.

## File Shape

```ts
import { defineConfig } from "astrograph";

export default defineConfig({
  summaryStrategy: "doc-comments-first",
  storageMode: "wal",
  storageLocation: "repo-local",
  observability: {
    retentionDays: 3,
    redactSourceText: true,
  },
  ranking: {
    exactName: 1000,
    filePathContains: 120,
    exportedBonus: 20,
  },
  performance: {
    include: ["src/**/*.{ts,tsx,js,jsx}"],
    exclude: ["**/*.test.ts"],
    fileProcessingConcurrency: "auto",
    workerPool: {
      enabled: false,
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
    maxSymbolResults: 8,
    maxTextResults: 100,
    maxChildProcessOutputBytes: 1000000,
    maxLiveSearchMatches: 100,
  },
});
```

If no TypeScript config is present, Astrograph can still read legacy
`astrograph.config.json`, but `astrograph.config.ts` is the preferred surface.

## Top-Level Options

### `summaryStrategy`

Controls how file summaries are generated.

Supported values:

- `doc-comments-first`
- `signature-only`

### `storageMode`

Current supported value:

- `wal`

### `storageLocation`

Controls where the repository’s persistent index, metadata, integrity marker,
storage version, and events live. Supported values are `repo-local` (the
default) and `global`. A repository setting overrides the user-level default
written by `astrograph install --global`.

Global mode still uses one SQLite database per canonical repository root. It
does not share mutable index rows or source data between repositories.

The CLI can override this setting for a single command, without rewriting
configuration:

```bash
astrograph cli index-folder --repo /repo --storage-location global
astrograph cli diagnostics --repo /repo --storage-location repo-local
```

Precedence is explicit CLI selection, repository configuration, then the
user-level default written by `astrograph install --global`.

### `observability`

Controls local event retention and redaction.

Available fields:

- `enabled`
- `host`
- `port`
- `recentLimit`
- `retentionDays`
- `snapshotIntervalMs`
- `redactSourceText`

The most important setting for most users is `redactSourceText`, which defaults
to `true`.

### `performance`

Controls indexing scope and concurrency.

Available fields:

- `include`
- `exclude`
- `fileProcessingConcurrency`
- `workerPool.enabled`
- `workerPool.maxWorkers`

### `ranking`

Controls deterministic retrieval weights.

`pathPresets` is optional repository context for intent-aware ranking. A
configured category receives a small boost only when the query includes its
corresponding intent and the result matches its explicit glob pattern; generic
ranking remains the fallback. Use only the bounded category vocabulary and
explicit glob patterns:

```ts
ranking: {
  pathPresets: {
    generationCode: ["tools/**", "scripts/generate-*.ts"],
    appCode: ["src/app/**"],
    sharedRuntime: ["src/runtime/**"],
  },
},
```

Available categories are `generationCode`, `appCode`, and `sharedRuntime`.
Each accepts at most 32 nonempty patterns; unknown categories are rejected.

Available fields:

- `exactName`
- `exactQualifiedName`
- `prefixName`
- `prefixQualifiedName`
- `containsName`
- `containsQualifiedName`
- `signatureContains`
- `summaryContains`
- `filePathContains`
- `exactWord`
- `tokenMatch`
- `exportedBonus`
- `pathPresets`

### `watch`

Controls local watch-mode behavior.

Available fields:

- `backend`
- `debounceMs`

Supported backends:

- `auto`
- `parcel`
- `node-fs-watch`
- `polling`

### `limits`

Safety limits for discovery, indexing, and result size.

Available fields:

- `maxFilesDiscovered`
- `maxFileBytes`
- `maxSymbolsPerFile`
- `maxSymbolResults`
- `maxTextResults`
- `maxChildProcessOutputBytes`
- `maxLiveSearchMatches`

## Common Patterns

### Narrow indexing to source files

```ts
import { defineConfig } from "astrograph";

export default defineConfig({
  performance: {
    include: ["src/**/*.{ts,tsx,js,jsx}"],
    exclude: ["**/*.test.ts"],
  },
});
```

### Force polling watch mode

```ts
import { defineConfig } from "astrograph";

export default defineConfig({
  watch: {
    backend: "polling",
    debounceMs: 150,
  },
});
```

### Keep observability privacy-safe

```ts
import { defineConfig } from "astrograph";

export default defineConfig({
  observability: {
    retentionDays: 3,
    redactSourceText: true,
  },
});
```

## Where To Go Next

- For command usage: [CLI Reference](./cli.md)
- For performance tuning: [Performance Guide](../guides/performance.md)
- For failure recovery: [Troubleshooting](../guides/troubleshooting.md)
