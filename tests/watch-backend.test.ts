import { afterEach, describe, expect, it } from "vitest";

import {
  normalizeNodeFsWatchEvent,
  normalizeParcelWatchEvents,
  normalizeWatchAbsolutePath,
  subscribeRepo,
} from "../src/watch-backend.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

afterEach(async () => {
  await cleanupFixtureRepos();
});

describe("watch backend", () => {
  it("normalizes parcel events to repo-relative paths", () => {
    const repoRoot = "/repo";

    expect(
      normalizeParcelWatchEvents(repoRoot, [
        { path: "/repo/src/math.ts", type: "update" },
        { path: "/repo/.astrograph/index.sqlite", type: "update" },
        { path: "/other/place.ts", type: "create" },
      ]),
    ).toEqual([
      {
        path: "src/math.ts",
        type: "update",
      },
    ]);
  });

  it("normalizes node fs watch events and filters path escapes", () => {
    const repoRoot = "/repo";

    expect(
      normalizeNodeFsWatchEvent(repoRoot, "rename", "src/math.ts"),
    ).toEqual([
      {
        path: "src/math.ts",
        type: "rename",
      },
    ]);
    expect(
      normalizeNodeFsWatchEvent(repoRoot, "change", "../outside.ts"),
    ).toEqual([]);
  });

  it("filters ignored segments and repo-internal artifacts", () => {
    const repoRoot = "/repo";

    expect(normalizeWatchAbsolutePath(repoRoot, "/repo/node_modules/pkg/index.js")).toBeNull();
    expect(normalizeWatchAbsolutePath(repoRoot, "/repo/.astrograph/index.sqlite")).toBeNull();
    expect(normalizeWatchAbsolutePath(repoRoot, "/repo/src/strings.ts")).toBe("src/strings.ts");
  });

  it("subscribes with a native backend and closes cleanly", async () => {
    const repoRoot = await createFixtureRepo();
    const subscription = await subscribeRepo(repoRoot, () => {});

    try {
      expect(["parcel", "node-fs-watch"]).toContain(subscription.backend);
    } finally {
      await subscription.close();
    }
  });
});
