export const DAEMON_PROTOCOL_VERSION = 1;
export const MAX_DAEMON_MESSAGE_BYTES = 1_000_000;

export interface DaemonRequest {
  protocolVersion: typeof DAEMON_PROTOCOL_VERSION;
  id: string;
  token: string;
  command: string;
  input: Record<string, unknown>;
}

export interface DaemonSuccessResponse {
  protocolVersion: typeof DAEMON_PROTOCOL_VERSION;
  id: string;
  ok: true;
  data: unknown;
}

export interface DaemonFailureResponse {
  protocolVersion: typeof DAEMON_PROTOCOL_VERSION;
  id: string | null;
  ok: false;
  error: {
    code: "invalid_request" | "unauthorized" | "unsupported_version" | "command_failed";
    message: string;
  };
}

export type DaemonResponse = DaemonSuccessResponse | DaemonFailureResponse;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

export function encodeDaemonMessage(message: DaemonRequest | DaemonResponse): string {
  const serialized = JSON.stringify(message);
  if (byteLength(serialized) > MAX_DAEMON_MESSAGE_BYTES) {
    throw new Error(`Daemon message exceeds ${MAX_DAEMON_MESSAGE_BYTES} bytes`);
  }
  return `${serialized}\n`;
}

export function parseDaemonRequest(line: string): DaemonRequest {
  if (byteLength(line) > MAX_DAEMON_MESSAGE_BYTES) {
    throw new Error(`Daemon message exceeds ${MAX_DAEMON_MESSAGE_BYTES} bytes`);
  }

  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error("Daemon message must be JSON");
  }

  if (!isRecord(value)) {
    throw new Error("Daemon request must be an object");
  }
  if (value.protocolVersion !== DAEMON_PROTOCOL_VERSION) {
    throw new Error("Unsupported daemon protocol version");
  }
  if (!isNonEmptyString(value.id)) {
    throw new Error("Daemon request requires an id");
  }
  if (!isNonEmptyString(value.token)) {
    throw new Error("Daemon request requires a token");
  }
  if (!isNonEmptyString(value.command)) {
    throw new Error("Daemon request requires a command");
  }
  if (!isRecord(value.input)) {
    throw new Error("Daemon request input must be an object");
  }

  return value as unknown as DaemonRequest;
}

export function daemonFailure(
  code: DaemonFailureResponse["error"]["code"],
  message: string,
  id: string | null = null,
): DaemonFailureResponse {
  return {
    protocolVersion: DAEMON_PROTOCOL_VERSION,
    id,
    ok: false,
    error: { code, message },
  };
}
