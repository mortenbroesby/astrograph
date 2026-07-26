import { afterEach, describe, expect, it } from "vitest";

import { dispatchTool, setMcpCommandExecutorForTest } from "../src/mcp.ts";
import { McpContentReferenceStore, parseMcpSession } from "../src/mcp-session.ts";

const session = { capability: "content-references-v1" as const, id: "session_reference_test_1234" };
const response = [{ path: "src/index.ts", language: "ts", symbolCount: 1 }];
const restores: Array<() => void> = [];

afterEach(() => {
  restores.splice(0).forEach((restore) => restore());
});

describe("MCP content references", () => {
  it("adds an opaque full-response reference only after explicit opt-in", async () => {
    restores.push(setMcpCommandExecutorForTest(async () => response));

    const ordinary = await dispatchTool("get_file_tree", { repoRoot: "/fixture" });
    const first = await dispatchTool("get_file_tree", { repoRoot: "/fixture", session });
    expect(ordinary.ok && ordinary.meta).not.toHaveProperty("contentReference");
    expect(first).toMatchObject({
      ok: true,
      meta: { contentReference: { id: expect.stringMatching(/^sha256:[a-f0-9]{64}$/), representation: "full", reason: "new_content" } },
    });
  });

  it("keeps the full response when the client already knows the content id", async () => {
    const store = new McpContentReferenceStore();
    const envelope = { ok: true as const, data: response, meta: { toolVersion: "1" as const, tokenBudgetUsed: null, dataFreshness: "fresh" as const } };
    const first = store.record(parseMcpSession(session)!, envelope, 0);
    const second = store.record(parseMcpSession({ ...session, knownContentIds: [first.id] })!, envelope, 1);

    expect(second).toMatchObject({ id: first.id, representation: "full", reason: "known_content_no_delta_support" });
  });

  it("rejects malformed capabilities before command execution", async () => {
    let executed = false;
    restores.push(setMcpCommandExecutorForTest(async () => {
      executed = true;
      return response;
    }));

    await expect(dispatchTool("get_file_tree", {
      repoRoot: "/fixture",
      session: { capability: "content-references-v1", id: "short" },
    })).resolves.toMatchObject({ ok: false, error: { code: "invalid_argument" } });
    expect(executed).toBe(false);
  });
});
