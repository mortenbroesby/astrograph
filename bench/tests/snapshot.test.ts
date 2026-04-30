import { appendFileSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { assertStrictSnapshot, getRepoSnapshot } from "../src/index.ts";
import { createBenchmarkFixtureRepo } from "./benchmark-fixture.ts";

describe("benchmark snapshot", () => {
  it("reads a clean repo snapshot and validates strict mode", () => {
    const fixture = createBenchmarkFixtureRepo();

    try {
      const snapshot = getRepoSnapshot(fixture.repoRoot);

      expect(snapshot.repoSha).toBeTruthy();
      expect(snapshot.isDirty).toBe(false);
      expect(() =>
        assertStrictSnapshot(snapshot, snapshot.repoSha ?? ""),
      ).not.toThrow();
    } finally {
      rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  it("fails strict mode on a dirty checkout", () => {
    const fixture = createBenchmarkFixtureRepo();

    try {
      appendFileSync(
        `${fixture.repoRoot}/bench/src/corpus.ts`,
        "\nexport const dirty = true;\n",
      );

      const snapshot = getRepoSnapshot(fixture.repoRoot);

      expect(snapshot.isDirty).toBe(true);
      expect(() =>
        assertStrictSnapshot(snapshot, fixture.repoSha),
      ).toThrow(/clean checkout/i);
    } finally {
      rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  it("fails strict mode on repo sha mismatch", () => {
    const fixture = createBenchmarkFixtureRepo();

    try {
      const snapshot = getRepoSnapshot(fixture.repoRoot);

      expect(() =>
        assertStrictSnapshot(snapshot, "deadbeef"),
      ).toThrow(/requires repo SHA/i);
    } finally {
      rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });
});
