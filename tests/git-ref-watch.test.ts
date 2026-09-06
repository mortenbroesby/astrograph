import { writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { GitRefMonitor } from "../src/git-ref-monitor.ts";

let onChange: (() => Promise<void> | void) | null = null;

vi.mock("../src/git-ref-monitor.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/git-ref-monitor.ts")>();
  return {
    ...actual,
    createGitRefMonitor(input: { onChange(): Promise<void> | void }): GitRefMonitor {
      onChange = input.onChange;
      return {
        async pollOnce() {
          return false;
        },
        async start() {},
        close() {},
      };
    },
  };
});

import { searchSymbols, watchFolder } from "../src/index.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

afterEach(async () => {
  onChange = null;
  await cleanupFixtureRepos();
});

describe("Git ref watch reconciliation", () => {
  it("queues existing folder reconciliation when the ref monitor reports a change", async () => {
    const repoRoot = await createFixtureRepo();
    const watcher = await watchFolder({ repoRoot, backend: "polling", debounceMs: 50 });

    await writeFile(
      path.join(repoRoot, "src", "git-ref.ts"),
      "export const gitRefReconciled = true;\n",
    );
    expect(onChange).not.toBeNull();
    await onChange?.();
    await watcher.close();

    expect((await searchSymbols({ repoRoot, query: "gitRefReconciled" }))
      .map((entry) => entry.name)).toContain("gitRefReconciled");
  });
});
