import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const repoRoot = new URL("..", import.meta.url);

function run(...args: string[]) {
  return execFileSync("node", ["./scripts/agent-contract.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function runHook(payload: unknown) {
  return JSON.parse(execFileSync("node", [".agents/hooks.mjs"], {
    cwd: repoRoot,
    input: JSON.stringify(payload),
    encoding: "utf8",
  }));
}

describe("agent contract", () => {
  it("keeps the checked-in Codex adapter coherent", () => {
    expect(run("check")).toContain("Agent contract OK.");
  });

  it("discovers, reads, searches, and routes repo-owned skills", () => {
    expect(run("skills:list")).toContain("ponytail");
    expect(run("skills:read", "ponytail")).toContain("# Ponytail");
    expect(run("skills:search", "smallest reliable solution")).toContain("ponytail");
    expect(run("skills:route", "debug a failing test")).toContain("debugging-and-error-recovery");
  });

  it("blocks destructive commands and protected apply-patch edits", () => {
    expect(runHook({
      hook_event_name: "UserPromptSubmit",
      prompt: "token=ghp_abcdefghijklmnopqrstuvwxyz1234567890",
      cwd: repoRoot.pathname,
    })).toMatchObject({ decision: "block" });

    expect(runHook({
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "git reset --hard" },
      cwd: repoRoot.pathname,
    })).toMatchObject({
      hookSpecificOutput: {
        permissionDecision: "deny",
      },
    });

    expect(runHook({
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: { command: "*** Begin Patch\n*** Update File: .env\n*** End Patch" },
      cwd: repoRoot.pathname,
    })).toMatchObject({
      hookSpecificOutput: {
        permissionDecision: "deny",
        permissionDecisionReason: expect.stringContaining("protected file"),
      },
    });
  });
});
