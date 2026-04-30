import { writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { searchLiveText } from "../src/live-search.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

afterEach(async () => {
  await cleanupFixtureRepos();
});

describe("live search", () => {
  it("finds fixed-string matches with special characters", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "special.ts"),
      "export const pattern = '[abc]+(value)?';\n",
    );

    const matches = await searchLiveText({
      repoRoot,
      query: "[abc]+(value)?",
    });

    expect(matches).toEqual([
      expect.objectContaining({
        filePath: "src/special.ts",
        source: "live_disk_match",
        reason: "ripgrep_fallback",
      }),
    ]);
  });

  it("respects the match limit", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "many.ts"),
      Array.from({ length: 5 }, () => "export const repeated = 'hello';").join("\n"),
    );

    const matches = await searchLiveText({
      repoRoot,
      query: "hello",
      maxMatches: 2,
    });

    expect(matches).toHaveLength(2);
  });

  it("truncates output when the byte limit is exceeded", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "src", "large.ts"),
      "export const large = 'hello world hello world hello world';\n",
    );

    const matches = await searchLiveText({
      repoRoot,
      query: "hello",
      maxOutputBytes: 10,
    });

    expect(matches).toEqual([]);
  });
});
