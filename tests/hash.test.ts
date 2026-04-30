import { describe, expect, it } from "vitest";

import { hashBytes, hashString } from "../src/hash.ts";

describe("astrograph hash policy", () => {
  it("uses sha256 for integrity hashes", () => {
    expect(hashString("alpha", "integrity")).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it("uses xxh64 for routine fingerprints", () => {
    expect(hashString("alpha", "content_fingerprint")).toMatch(/^xxh64:[0-9a-f]{16}$/u);
    expect(hashString("alpha", "parse_fingerprint")).toMatch(/^xxh64:[0-9a-f]{16}$/u);
    expect(hashString("alpha", "symbol_signature")).toMatch(/^xxh64:[0-9a-f]{16}$/u);
    expect(hashString("alpha", "import_graph")).toMatch(/^xxh64:[0-9a-f]{16}$/u);
    expect(hashString("alpha", "directory_snapshot")).toMatch(/^xxh64:[0-9a-f]{16}$/u);
  });

  it("is stable for the same input and purpose", () => {
    expect(hashString("alpha", "integrity")).toBe(hashString("alpha", "integrity"));
    expect(hashString("alpha", "content_fingerprint")).toBe(
      hashString("alpha", "content_fingerprint"),
    );
  });

  it("changes when the input changes", () => {
    expect(hashString("alpha", "integrity")).not.toBe(hashString("beta", "integrity"));
    expect(hashString("alpha", "content_fingerprint")).not.toBe(
      hashString("beta", "content_fingerprint"),
    );
  });

  it("supports empty and large byte inputs", () => {
    const largeBytes = new TextEncoder().encode("x".repeat(100_000));

    expect(hashBytes(new Uint8Array(), "integrity")).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(hashBytes(largeBytes, "directory_snapshot")).toMatch(/^xxh64:[0-9a-f]{16}$/u);
  });
});
