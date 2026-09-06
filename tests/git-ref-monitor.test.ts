import { describe, expect, it, vi } from "vitest";

import { createGitRefMonitor } from "../src/git-ref-monitor.ts";
import type { GitCheckoutProbeResult } from "../src/git-checkout.ts";

function checkout(overrides: Partial<GitCheckoutProbeResult> = {}): GitCheckoutProbeResult {
  return {
    mode: "git-branch",
    repoRoot: "/repo",
    headOid: "a1",
    branchRef: "main",
    diagnostic: null,
    ...overrides,
  };
}

describe("Git ref monitor", () => {
  it("refreshes only when the observed checkout identity changes", async () => {
    const changes = vi.fn();
    const probe = vi.fn()
      .mockResolvedValueOnce(checkout())
      .mockResolvedValueOnce(checkout())
      .mockResolvedValueOnce(checkout({ headOid: "b2" }));
    const monitor = createGitRefMonitor({ repoRoot: "/repo", probe, onChange: changes });

    await expect(monitor.pollOnce()).resolves.toBe(false);
    await expect(monitor.pollOnce()).resolves.toBe(false);
    await expect(monitor.pollOnce()).resolves.toBe(true);
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it("treats branch and checkout-mode changes as reconciliation signals", async () => {
    const changes = vi.fn();
    const probe = vi.fn()
      .mockResolvedValueOnce(checkout())
      .mockResolvedValueOnce(checkout({ branchRef: "feature" }))
      .mockResolvedValueOnce(checkout({ mode: "git-detached", branchRef: null }));
    const monitor = createGitRefMonitor({ repoRoot: "/repo", probe, onChange: changes });

    await monitor.pollOnce();
    await monitor.pollOnce();
    await monitor.pollOnce();
    expect(changes).toHaveBeenCalledTimes(2);
  });

  it("does not refresh while Git is unavailable and stops permanently after close", async () => {
    const changes = vi.fn();
    const probe = vi.fn()
      .mockResolvedValueOnce(checkout({ mode: "git-unavailable", headOid: null }))
      .mockResolvedValueOnce(checkout({ headOid: "b2" }));
    const monitor = createGitRefMonitor({ repoRoot: "/repo", probe, onChange: changes });

    await expect(monitor.pollOnce()).resolves.toBe(false);
    monitor.close();
    await expect(monitor.pollOnce()).resolves.toBe(false);
    expect(changes).not.toHaveBeenCalled();
  });
});
