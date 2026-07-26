import { describe, expect, it } from "vitest";

import {
  DAEMON_PROTOCOL_VERSION,
  MAX_DAEMON_MESSAGE_BYTES,
  daemonFailure,
  encodeDaemonMessage,
  parseDaemonRequest,
} from "../src/daemon-protocol.ts";

describe("daemon protocol", () => {
  it("round-trips a bounded internal request", () => {
    const message = {
      protocolVersion: DAEMON_PROTOCOL_VERSION,
      id: "request-1",
      token: "local-capability",
      command: "search_symbols",
      input: { repoRoot: "/repo", query: "daemon" },
    } as const;

    expect(parseDaemonRequest(encodeDaemonMessage(message).trim())).toEqual(message);
  });

  it("rejects malformed, incompatible, and oversized requests before dispatch", () => {
    expect(() => parseDaemonRequest("not-json")).toThrow("must be JSON");
    expect(() => parseDaemonRequest(JSON.stringify({
      protocolVersion: 2,
      id: "request-1",
      token: "local-capability",
      command: "search_symbols",
      input: {},
    }))).toThrow("Unsupported daemon protocol version");
    expect(() => parseDaemonRequest(JSON.stringify({
      protocolVersion: DAEMON_PROTOCOL_VERSION,
      id: "request-1",
      token: "local-capability",
      command: "search_symbols",
      input: [],
    }))).toThrow("input must be an object");
    expect(() => parseDaemonRequest("x".repeat(MAX_DAEMON_MESSAGE_BYTES + 1))).toThrow("exceeds");
  });

  it("uses a bounded public failure shape", () => {
    expect(daemonFailure("unauthorized", "Invalid daemon capability", "request-1")).toEqual({
      protocolVersion: DAEMON_PROTOCOL_VERSION,
      id: "request-1",
      ok: false,
      error: { code: "unauthorized", message: "Invalid daemon capability" },
    });
  });
});
