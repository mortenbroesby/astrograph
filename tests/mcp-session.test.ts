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

  it("returns a reference-only response when the client already knows the exact content id", async () => {
    const store = new McpContentReferenceStore();
    const envelope = { ok: true as const, data: response, meta: { toolVersion: "1" as const, tokenBudgetUsed: null, dataFreshness: "fresh" as const } };
    const first = store.record(parseMcpSession(session)!, envelope, 0);
    const second = store.record(parseMcpSession({ ...session, knownContentIds: [first.id] })!, envelope, 1);

    expect(second).toMatchObject({ id: first.id, representation: "reference", reason: "known_exact_content" });
  });

  it("uses the full fallback when current content differs from the known id", async () => {
    restores.push(setMcpCommandExecutorForTest(async () => response));
    const first = await dispatchTool("get_file_tree", { repoRoot: "/fixture", session });
    const firstId = first.ok ? first.meta.contentReference?.id : undefined;
    restores.splice(0).forEach((restore) => restore());
    restores.push(setMcpCommandExecutorForTest(async () => [...response, { path: "src/next.ts", language: "ts", symbolCount: 1 }]));

    const changed = await dispatchTool("get_file_tree", { repoRoot: "/fixture", session: { ...session, knownContentIds: [firstId!] } });
    expect(changed).toMatchObject({ ok: true, data: expect.any(Array), meta: { contentReference: { representation: "full", reason: "new_content" } } });
  });

  it("omits data only after the client supplies the exact current id", async () => {
    restores.push(setMcpCommandExecutorForTest(async () => response));
    const first = await dispatchTool("get_file_tree", { repoRoot: "/fixture", session });
    const id = first.ok ? first.meta.contentReference?.id : undefined;

    const repeated = await dispatchTool("get_file_tree", { repoRoot: "/fixture", session: { ...session, knownContentIds: [id!] } });
    expect(repeated).toMatchObject({ ok: true, data: null, meta: { contentReference: { id, representation: "reference", reason: "known_exact_content" } } });
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
