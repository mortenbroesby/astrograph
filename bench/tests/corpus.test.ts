import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

import { describe, expect, it } from "vitest";

import {
  loadBenchmarkCorpus,
  loadBenchmarkTaskCard,
} from "../src/index.ts";
import { workspaceRoot } from "./benchmark-fixture.ts";

const checkedInCorpusPath = path.resolve(
  workspaceRoot,
  "bench",
  "tests",
  "fixtures",
  "benchmarks",
  "ai-context-engine-benchmark-corpus.json",
);

function makeFixtureCorpus() {
  const root = mkdtempSync(path.join(os.tmpdir(), "aice-bench-"));
  const specDir = path.join(root, ".specs", "benchmarks");
  const taskDir = path.join(specDir, "tasks");
  mkdirSync(taskDir, { recursive: true });

  const manifestPath = path.join(
    specDir,
    "ai-context-engine-benchmark-corpus.json",
  );
  const taskAlphaPath = path.join(taskDir, "alpha.md");
  const taskBetaPath = path.join(taskDir, "beta.md");

  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        benchmark: "ai-context-engine",
        repo: "astrograph",
        repoSha: "abc123",
        tokenizer: "cl100k_base",
        tasks: [
          {
            id: "beta",
            path: "tasks/beta.md",
            slice: ".",
            workflows: ["symbol-first", "text-first"],
            allowedPaths: ["**"],
            targets: [
              {
                kind: "symbol",
                value: "searchSymbols",
                mode: "exact",
              },
            ],
          },
          {
            id: "alpha",
            path: "tasks/alpha.md",
            slice: ".",
            workflows: ["baseline", "discovery-first"],
            allowedPaths: ["**"],
            targets: [
              {
                kind: "symbol",
                value: "loadBenchmarkCorpus",
                mode: "exact",
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );

  writeFileSync(
    taskAlphaPath,
    `---
id: alpha
slice: .
query: Find the corpus loader
workflowSet: [baseline, discovery-first]
allowedPaths:
  - **
targets:
  - kind: symbol
    value: loadBenchmarkCorpus
    mode: exact
successCriteria:
  - task loads in order
---

Alpha task body.
`,
  );

  writeFileSync(
    taskBetaPath,
    `---
id: beta
slice: .
query: Find the symbol search entrypoint
workflowSet: [symbol-first, text-first]
allowedPaths:
  - **
targets:
  - kind: symbol
    value: searchSymbols
    mode: exact
successCriteria:
  - task loads in order
---

Beta task body.
`,
  );

  return {
    root,
    manifestPath,
    taskAlphaPath,
    taskBetaPath,
  };
}

describe("ai-context-engine-bench corpus loader", () => {
  it("loads the checked-in benchmark corpus", () => {
    const corpus = loadBenchmarkCorpus(checkedInCorpusPath);

    expect(corpus.manifest.repoSha).toBe(
      "74f79fa02cb2956dfce8dcef4333dfeb0de1a1bf",
    );
    expect(corpus.manifest.tasks).toHaveLength(6);
    expect(corpus.tasks).toHaveLength(6);
    expect(corpus.tasks[0].frontmatter.id).toBe("task-corpus-loader");
    expect(corpus.tasks[0].frontmatter.query).toBe("loadBenchmarkCorpus");
  });

  it("loads the manifest and task cards in manifest order", () => {
    const fixture = makeFixtureCorpus();

    try {
      const corpus = loadBenchmarkCorpus(fixture.manifestPath);

      expect(corpus.manifest.tasks.map((task) => task.id)).toEqual([
        "beta",
        "alpha",
      ]);
      expect(corpus.tasks.map((task) => task.frontmatter.id)).toEqual([
        "beta",
        "alpha",
      ]);
      expect(corpus.tasks[0].body.trim()).toBe("Beta task body.");
      expect(corpus.tasks[1].body.trim()).toBe("Alpha task body.");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("loads a task card frontmatter payload", () => {
    const fixture = makeFixtureCorpus();

    try {
      const taskCard = loadBenchmarkTaskCard(fixture.taskAlphaPath);

      expect(taskCard.frontmatter).toEqual({
        id: "alpha",
        slice: ".",
        query: "Find the corpus loader",
        workflowSet: ["baseline", "discovery-first"],
        allowedPaths: ["**"],
        targets: [
          {
            kind: "symbol",
            value: "loadBenchmarkCorpus",
            mode: "exact",
          },
        ],
        successCriteria: ["task loads in order"],
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("fails fast when a task card disagrees with the manifest", () => {
    const fixture = makeFixtureCorpus();
    writeFileSync(
      fixture.taskBetaPath,
      `---
id: beta
slice: .
query: Find the symbol search entrypoint
workflowSet: [symbol-first]
allowedPaths:
  - **
targets:
  - kind: symbol
    value: searchSymbols
    mode: exact
successCriteria:
  - task loads in order
---

Beta task body.
`,
    );

    try {
      expect(() => loadBenchmarkCorpus(fixture.manifestPath)).toThrow(
        /workflowSet|workflows|beta/i,
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects task paths that escape the corpus root", () => {
    const fixture = makeFixtureCorpus();
    writeFileSync(
      fixture.manifestPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          benchmark: "ai-context-engine",
          repo: "astrograph",
          repoSha: "abc123",
          tokenizer: "cl100k_base",
          tasks: [
            {
              id: "beta",
              path: "../escape.md",
              slice: ".",
              workflows: ["symbol-first"],
              allowedPaths: ["**"],
              targets: [
                {
                  kind: "symbol",
                  value: "searchSymbols",
                  mode: "exact",
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    );

    try {
      expect(() => loadBenchmarkCorpus(fixture.manifestPath)).toThrow(
        /escapes the corpus root/i,
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
