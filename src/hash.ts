import { createHash } from "node:crypto";

import { xxh64 } from "@node-rs/xxhash";

export type HashPurpose =
  | "integrity"
  | "content_fingerprint"
  | "parse_fingerprint"
  | "symbol_signature"
  | "import_graph"
  | "directory_snapshot";

function sha256Hex(input: Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

function xxh64Hex(input: Uint8Array): string {
  return xxh64(input).toString(16).padStart(16, "0");
}

function encoder() {
  return new TextEncoder();
}

function algorithmForPurpose(purpose: HashPurpose): "sha256" | "xxh64" {
  switch (purpose) {
    case "integrity":
      return "sha256";
    case "content_fingerprint":
    case "parse_fingerprint":
    case "symbol_signature":
    case "import_graph":
    case "directory_snapshot":
      return "xxh64";
  }
}

export function hashBytes(input: Uint8Array, purpose: HashPurpose): string {
  const algorithm = algorithmForPurpose(purpose);
  return algorithm === "sha256"
    ? `${algorithm}:${sha256Hex(input)}`
    : `${algorithm}:${xxh64Hex(input)}`;
}

export function hashString(input: string, purpose: HashPurpose): string {
  return hashBytes(encoder().encode(input), purpose);
}
