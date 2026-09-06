import { afterEach, describe, expect, it, vi } from "vitest";

const { probeGitCheckout } = vi.hoisted(() => ({
  probeGitCheckout: vi.fn(),
}));

vi.mock("../src/git-checkout.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/git-checkout.ts")>();
  probeGitCheckout.mockImplementation(actual.probeGitCheckout);
  return { ...actual, probeGitCheckout };
});

import { indexFolder } from "../src/index.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

afterEach(async () => {
  delete process.env.ASTROGRAPH_DAEMON_PROCESS;
  probeGitCheckout.mockClear();
  await cleanupFixtureRepos();
});

describe("checkout mapping persistence", () => {
  it("adds only one checkout probe regardless of the indexed file count", async () => {
    const repoRoot = await createFixtureRepo();
    process.env.ASTROGRAPH_DAEMON_PROCESS = "1";

    await indexFolder({ repoRoot });

    expect(probeGitCheckout).toHaveBeenCalledTimes(3);
  });
});
