import { createHash } from "node:crypto";

import type { McpEnvelope } from "./mcp-contract.ts";

export const MCP_SESSION_CAPABILITY = "content-references-v1";
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const CONTENT_ID_PATTERN = /^sha256:[a-f0-9]{64}$/;
const MAX_SESSIONS = 64;
const MAX_KNOWN_CONTENT_IDS = 64;
const MAX_KNOWN_CONTENT_BYTES = 8_192;
const SESSION_TTL_MS = 15 * 60_000;

export interface McpSessionInput {
  capability: typeof MCP_SESSION_CAPABILITY;
  id: string;
  knownContentIds: string[];
}

export interface McpContentReference {
  id: string;
  representation: "full";
  reason: "new_content" | "known_content_no_delta_support";
}

interface SessionRecord {
  expiresAt: number;
  knownContentIds: Set<string>;
}

export function parseMcpSession(value: unknown): McpSessionInput | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || value.capability !== MCP_SESSION_CAPABILITY || !isSessionId(value.id)) {
    throw new Error("Invalid MCP session capability or id");
  }
  const knownContentIds = value.knownContentIds ?? [];
  if (!Array.isArray(knownContentIds) || knownContentIds.length > MAX_KNOWN_CONTENT_IDS
    || !knownContentIds.every(isContentId)
    || Buffer.byteLength(knownContentIds.join("\n"), "utf8") > MAX_KNOWN_CONTENT_BYTES) {
    throw new Error("Invalid MCP knownContentIds");
  }
  return { capability: MCP_SESSION_CAPABILITY, id: value.id, knownContentIds: [...new Set(knownContentIds)] };
}

export class McpContentReferenceStore {
  private readonly sessions = new Map<string, SessionRecord>();

  record(session: McpSessionInput, envelope: McpEnvelope<unknown>, now = Date.now()): McpContentReference {
    this.prune(now);
    let record = this.sessions.get(session.id);
    if (!record) {
      if (this.sessions.size >= MAX_SESSIONS) this.sessions.delete(this.sessions.keys().next().value as string);
      record = { expiresAt: now + SESSION_TTL_MS, knownContentIds: new Set() };
      this.sessions.set(session.id, record);
    }
    record.expiresAt = now + SESSION_TTL_MS;
    for (const contentId of session.knownContentIds) record.knownContentIds.add(contentId);

    const id = `sha256:${createHash("sha256").update(JSON.stringify(envelope)).digest("hex")}`;
    const known = record.knownContentIds.has(id);
    record.knownContentIds.add(id);
    while (record.knownContentIds.size > MAX_KNOWN_CONTENT_IDS) {
      record.knownContentIds.delete(record.knownContentIds.values().next().value as string);
    }
    return { id, representation: "full", reason: known ? "known_content_no_delta_support" : "new_content" };
  }

  private prune(now: number) {
    for (const [id, record] of this.sessions) {
      if (record.expiresAt <= now) this.sessions.delete(id);
    }
  }
}

export const mcpContentReferenceStore = new McpContentReferenceStore();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}

function isContentId(value: unknown): value is string {
  return typeof value === "string" && CONTENT_ID_PATTERN.test(value);
}
