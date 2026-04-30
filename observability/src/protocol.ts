import { decode, encode } from "@msgpack/msgpack";

export interface HealthSnapshot {
  staleStatus?: string;
  freshnessMode?: string;
  indexedFiles?: number;
  indexedSymbols?: number;
  currentFiles?: number;
  changedFiles?: number;
  missingFiles?: number;
  extraFiles?: number;
  watch?: {
    status?: string;
    lastError?: string | null;
  };
  [key: string]: unknown;
}

export interface EventEnvelope {
  id?: string;
  ts?: string;
  repoRoot?: string;
  source?: string;
  event?: string;
  level?: string;
  data?: Record<string, unknown>;
}

export interface SnapshotMessage {
  type: "snapshot";
  snapshot: HealthSnapshot;
}

export interface RecentMessage {
  type: "recent";
  events: EventEnvelope[];
}

export interface EventMessage {
  type: "event";
  event: EventEnvelope;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type ObservabilityMessage =
  | SnapshotMessage
  | RecentMessage
  | EventMessage
  | ErrorMessage;

export async function fetchMsgpack<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/msgpack",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return decode(bytes) as T;
}

export function decodeSocketMessage(input: string | ArrayBuffer | Blob): Promise<ObservabilityMessage> | ObservabilityMessage {
  if (typeof input === "string") {
    return JSON.parse(input) as ObservabilityMessage;
  }

  if (input instanceof Blob) {
    return input.arrayBuffer().then((buffer) =>
      decode(new Uint8Array(buffer)) as ObservabilityMessage,
    );
  }

  return decode(new Uint8Array(input)) as ObservabilityMessage;
}

export function encodeMsgpack(value: unknown): Uint8Array {
  return encode(value);
}
