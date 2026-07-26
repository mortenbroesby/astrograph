import { afterEach, describe, expect, it } from "vitest";

import { createBookmark, deleteBookmark, listBookmarks, resolveBookmark } from "../src/index.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

afterEach(async () => {
  await cleanupFixtureRepos();
});

describe("explicit repository-local bookmarks", () => {
  it("creates, lists, and deletes only explicit symbol references", async () => {
    const repoRoot = await createFixtureRepo();
    const created = await createBookmark({ repoRoot, symbolId: "symbol:area", intent: "refactor", note: "preserve formatting" });
    await expect(listBookmarks(repoRoot)).resolves.toEqual([expect.objectContaining({
      id: created.id,
      symbolId: "symbol:area",
      intent: "refactor",
      note: "preserve formatting",
    })]);
    await expect(deleteBookmark({ repoRoot, id: created.id })).resolves.toEqual({ deleted: true });
    await expect(listBookmarks(repoRoot)).resolves.toEqual([]);
  });

  it("reports a missing or stale reference without reconstructing a source response", async () => {
    const repoRoot = await createFixtureRepo();
    const created = await createBookmark({ repoRoot, symbolId: "missing-symbol", intent: "debug" });
    await expect(resolveBookmark({ repoRoot, id: created.id })).resolves.toEqual({
      status: "missing",
      bookmark: expect.objectContaining({ id: created.id }),
    });
  });
});
