import { writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { shouldEmitIndexProfile, shouldUseIndexWorker } from "../src/storage.ts";
import { indexFolder, readRecentEngineEvents } from "../src/index.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

afterEach(async () => {
  await cleanupFixtureRepos();
});

describe("storage runtime mode", () => {
  it("keeps CLI indexing isolated but reuses resources inside the daemon", () => {
    expect(shouldUseIndexWorker({})).toBe(true);
    expect(shouldUseIndexWorker({ AI_CONTEXT_ENGINE_INDEX_WORKER_CHILD: "1" })).toBe(false);
    expect(shouldUseIndexWorker({ ASTROGRAPH_DAEMON_PROCESS: "1" })).toBe(false);
  });

  it("emits profiles only from the daemon/direct owner, never an index worker child", () => {
    expect(shouldEmitIndexProfile({ ASTROGRAPH_DAEMON_PROCESS: "1" })).toBe(true);
    expect(shouldEmitIndexProfile({ AI_CONTEXT_ENGINE_INDEX_WORKER_CHILD: "1" })).toBe(false);
    expect(shouldEmitIndexProfile({})).toBe(false);
  });

  it("records one enabled daemon index profile with phase timings", async () => {
    const repoRoot = await createFixtureRepo();
    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({ storageLocation: "repo-local", observability: { verbosePerformance: true } }),
    );
    const previous = process.env.ASTROGRAPH_DAEMON_PROCESS;
    process.env.ASTROGRAPH_DAEMON_PROCESS = "1";
    try {
      await indexFolder({ repoRoot });
    } finally {
      if (previous === undefined) delete process.env.ASTROGRAPH_DAEMON_PROCESS;
      else process.env.ASTROGRAPH_DAEMON_PROCESS = previous;
    }

    await vi.waitFor(async () => {
      const profiles = (await readRecentEngineEvents({ repoRoot })).filter(
        (event) => event.event === "index.profile",
      );
      expect(profiles).toHaveLength(1);
      expect(profiles[0]?.data).toMatchObject({
        outcome: "success",
        durationMs: expect.any(Number),
        discoveryMs: expect.any(Number),
        analysisMs: expect.any(Number),
        persistenceMs: expect.any(Number),
        finalizationMs: expect.any(Number),
        fileProcessingConcurrency: expect.any(Number),
      });
    });
  });
});
