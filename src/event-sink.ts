import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { loadRepoEngineConfig, resolveEnginePaths } from "./config.ts";
import { redactSecretLikeString } from "./privacy.ts";
import type {
  EngineEventEnvelope,
  EngineEventLevel,
  EngineEventSource,
} from "./types.ts";

export interface EngineEventInput {
  repoRoot: string;
  source: EngineEventSource;
  event: string;
  level: EngineEventLevel;
  correlationId?: string;
  data?: Record<string, unknown>;
}

let writeQueue = Promise.resolve();
const REDACTED_SOURCE_TEXT = "[REDACTED:source-text]";
const SOURCE_LIKE_KEYS = new Set([
  "content",
  "preview",
  "source",
  "text",
]);

function buildEventEnvelope(input: EngineEventInput): EngineEventEnvelope {
  return {
    id: randomUUID(),
    ts: new Date().toISOString(),
    repoRoot: input.repoRoot,
    source: input.source,
    event: input.event,
    level: input.level,
    correlationId: input.correlationId,
    data: input.data ?? {},
  };
}

function resolveRetentionCutoffIso(retentionDays: number): string {
  return new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
}

function retainEventLine(
  line: string,
  cutoffIso: string,
): boolean {
  if (line.trim() === "") {
    return false;
  }

  try {
    const parsed = JSON.parse(line) as { ts?: unknown };
    return typeof parsed.ts !== "string" || parsed.ts >= cutoffIso;
  } catch {
    return true;
  }
}

function parseEngineEventLine(line: string): EngineEventEnvelope | null {
  const trimmedLine = line.trim();
  if (trimmedLine === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmedLine) as EngineEventEnvelope;
    return typeof parsed.event === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function sanitizeEventValue(
  value: unknown,
  pathSegments: string[],
  redactSourceText: boolean,
): unknown {
  if (typeof value === "string") {
    const secretRedacted = redactSecretLikeString(value);
    if (
      redactSourceText
      && pathSegments.some((segment) => SOURCE_LIKE_KEYS.has(segment))
    ) {
      return secretRedacted === value ? REDACTED_SOURCE_TEXT : "[REDACTED:secret]";
    }
    return secretRedacted;
  }

  if (Array.isArray(value)) {
    return value.map((entry) =>
      sanitizeEventValue(entry, pathSegments, redactSourceText));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        sanitizeEventValue(entry, [...pathSegments, key], redactSourceText),
      ]),
    );
  }

  return value;
}

export async function appendEngineEvent(
  input: EngineEventInput,
): Promise<EngineEventEnvelope> {
  const repoConfig = await loadRepoEngineConfig(input.repoRoot);
  const envelope = buildEventEnvelope({
    ...input,
    repoRoot: repoConfig.repoRoot,
    data: sanitizeEventValue(
      input.data ?? {},
      [],
      repoConfig.observability.redactSourceText,
    ) as Record<string, unknown>,
  });
  const paths = resolveEnginePaths(repoConfig.repoRoot);
  const line = `${JSON.stringify(envelope)}\n`;

  writeQueue = writeQueue.then(async () => {
    await mkdir(paths.storageDir, { recursive: true });
    const cutoffIso = resolveRetentionCutoffIso(
      repoConfig.observability.retentionDays,
    );
    const existingContents = await readFile(paths.eventsPath, "utf8").catch(() => "");
    const retainedLines = existingContents
      .split("\n")
      .filter((existingLine) => retainEventLine(existingLine, cutoffIso));
    retainedLines.push(line.trimEnd());
    await writeFile(paths.eventsPath, `${retainedLines.join("\n")}\n`, "utf8");
  });

  await writeQueue;
  return envelope;
}

export function emitEngineEvent(input: EngineEventInput): void {
  void appendEngineEvent(input).catch(() => {
    // Observability must not break primary MCP, CLI, or watch behavior.
  });
}

export async function readRecentEngineEvents(input: {
  repoRoot: string;
  limit?: number;
}): Promise<EngineEventEnvelope[]> {
  const repoConfig = await loadRepoEngineConfig(input.repoRoot);
  const paths = resolveEnginePaths(repoConfig.repoRoot);
  const limit = Math.max(1, input.limit ?? 100);
  const contents = await readFile(paths.eventsPath, "utf8").catch(() => "");

  if (contents.trim() === "") {
    return [];
  }

  return contents
    .trimEnd()
    .split("\n")
    .map(parseEngineEventLine)
    .filter((event): event is EngineEventEnvelope => event !== null)
    .slice(-limit);
}
