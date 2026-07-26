import { probeGitCheckout } from "./git-checkout.ts";
import type { GitCheckoutProbeResult } from "./git-checkout.ts";

// ponytail: Keep the interval fixed until measured watch workloads need tuning.
// Add repository configuration only when a concrete workload proves 30 seconds unsuitable.
export const DEFAULT_GIT_REF_POLL_INTERVAL_MS = 30_000;

export type GitCheckoutProbe = (input: {
  repoRoot: string;
}) => Promise<GitCheckoutProbeResult>;

export interface GitRefMonitor {
  pollOnce(): Promise<boolean>;
  start(): Promise<void>;
  close(): void;
}

function checkoutIdentity(checkout: GitCheckoutProbeResult): string | null {
  if (checkout.mode === "filesystem" || checkout.mode === "git-unavailable"
    || checkout.headOid === null) {
    return null;
  }

  return JSON.stringify({
    mode: checkout.mode,
    headOid: checkout.headOid,
    branchRef: checkout.branchRef,
  });
}

export function createGitRefMonitor(input: {
  repoRoot: string;
  onChange(): Promise<void> | void;
  intervalMs?: number;
  probe?: GitCheckoutProbe;
  onError?: (error: unknown) => void;
}): GitRefMonitor {
  const probe = input.probe ?? probeGitCheckout;
  const intervalMs = input.intervalMs ?? DEFAULT_GIT_REF_POLL_INTERVAL_MS;
  let closed = false;
  let lastIdentity: string | null = null;
  let timer: NodeJS.Timeout | null = null;

  const pollOnce = async (): Promise<boolean> => {
    if (closed) {
      return false;
    }

    const currentIdentity = checkoutIdentity(await probe({ repoRoot: input.repoRoot }));
    if (currentIdentity === null) {
      lastIdentity = null;
      return false;
    }
    if (lastIdentity === null) {
      lastIdentity = currentIdentity;
      return false;
    }
    if (lastIdentity === currentIdentity) {
      return false;
    }

    lastIdentity = currentIdentity;
    await input.onChange();
    return true;
  };

  return {
    pollOnce,
    async start() {
      await pollOnce();
      if (closed || timer) {
        return;
      }
      timer = setInterval(() => {
        void pollOnce().catch((error: unknown) => input.onError?.(error));
      }, intervalMs);
    },
    close() {
      closed = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
