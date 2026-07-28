import { describe, expect, it } from "vitest";

import { shouldUseIndexWorker } from "../src/storage.ts";

describe("storage runtime mode", () => {
  it("keeps CLI indexing isolated but reuses resources inside the daemon", () => {
    expect(shouldUseIndexWorker({})).toBe(true);
    expect(shouldUseIndexWorker({ AI_CONTEXT_ENGINE_INDEX_WORKER_CHILD: "1" })).toBe(false);
    expect(shouldUseIndexWorker({ ASTROGRAPH_DAEMON_PROCESS: "1" })).toBe(false);
  });
});
