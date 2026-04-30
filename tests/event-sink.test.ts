import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { appendEngineEvent, readRecentEngineEvents } from "../src/index.ts";
import { resolveEnginePaths } from "../src/config.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

afterEach(async () => {
  await cleanupFixtureRepos();
});

describe("event sink privacy", () => {
  it("redacts source-like event payload fields by default", async () => {
    const repoRoot = await createFixtureRepo();

    await appendEngineEvent({
      repoRoot,
      source: "mcp",
      event: "test.event",
      level: "info",
      data: {
        source: "export const token = 'sk-123456789012345678901234';",
        preview: "const answer = 42;",
        nested: {
          text: "return apiKey;",
          token: "ghp_123456789012345678901234567890123456",
        },
        note: "safe metadata",
      },
    });

    const [event] = await readRecentEngineEvents({ repoRoot, limit: 1 });
    expect(event?.data).toMatchObject({
      source: "[REDACTED:secret]",
      preview: "[REDACTED:source-text]",
      nested: {
        text: "[REDACTED:source-text]",
        token: "[REDACTED:secret]",
      },
      note: "safe metadata",
    });
  });

  it("allows local source-text opt-out while still scrubbing obvious secrets", async () => {
    const repoRoot = await createFixtureRepo();

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        observability: {
          redactSourceText: false,
        },
      }),
    );

    await appendEngineEvent({
      repoRoot,
      source: "mcp",
      event: "test.event",
      level: "info",
      data: {
        source: "export const answer = 42;",
        token: "sk-123456789012345678901234",
      },
    });

    const [event] = await readRecentEngineEvents({ repoRoot, limit: 1 });
    expect(event?.data).toMatchObject({
      source: "export const answer = 42;",
      token: "[REDACTED:secret]",
    });

    const paths = resolveEnginePaths(repoRoot);
    const rawLog = await readFile(paths.eventsPath, "utf8");
    expect(rawLog).not.toContain("sk-123456789012345678901234");
  });

  it("retains at least three days of observability history by default", async () => {
    const repoRoot = await createFixtureRepo();
    const paths = resolveEnginePaths(repoRoot);
    await mkdir(path.dirname(paths.eventsPath), { recursive: true });

    await writeFile(
      paths.eventsPath,
      [
        JSON.stringify({
          id: "old-event",
          ts: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          repoRoot,
          source: "mcp",
          event: "test.old",
          level: "info",
          data: {},
        }),
        JSON.stringify({
          id: "recent-event",
          ts: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          repoRoot,
          source: "mcp",
          event: "test.recent",
          level: "info",
          data: {},
        }),
        "",
      ].join("\n"),
    );

    await appendEngineEvent({
      repoRoot,
      source: "mcp",
      event: "test.now",
      level: "info",
    });

    const rawLog = await readFile(paths.eventsPath, "utf8");
    expect(rawLog).not.toContain('"id":"old-event"');
    expect(rawLog).toContain('"id":"recent-event"');
    expect(rawLog).toContain('"event":"test.now"');
  });

  it("uses repo-configured observability retention windows", async () => {
    const repoRoot = await createFixtureRepo();
    const paths = resolveEnginePaths(repoRoot);
    await mkdir(path.dirname(paths.eventsPath), { recursive: true });

    await writeFile(
      path.join(repoRoot, "astrograph.config.json"),
      JSON.stringify({
        observability: {
          retentionDays: 5,
        },
      }),
    );

    await writeFile(
      paths.eventsPath,
      [
        JSON.stringify({
          id: "kept-event",
          ts: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          repoRoot,
          source: "mcp",
          event: "test.kept",
          level: "info",
          data: {},
        }),
        "",
      ].join("\n"),
    );

    await appendEngineEvent({
      repoRoot,
      source: "mcp",
      event: "test.now",
      level: "info",
    });

    const [keptEvent, currentEvent] = await readRecentEngineEvents({
      repoRoot,
      limit: 2,
    });
    expect(keptEvent?.id).toBe("kept-event");
    expect(currentEvent?.event).toBe("test.now");
  });
});
