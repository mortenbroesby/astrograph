import { describe, expect, it } from "vitest";

import { redactSecretLikeValue } from "../src/privacy.ts";

describe("output privacy policy primitive", () => {
  it("redacts only configured secret-like values and reports the lossy transformation", () => {
    expect(redactSecretLikeValue({
      source: "const token = 'ghp_123456789012345678901234567890123456';",
      ordinary: "hello",
      nested: ["AKIA1234567890ABCDEF", 1],
    })).toEqual({
      value: {
        source: "const token = '[REDACTED:secret]';",
        ordinary: "hello",
        nested: ["[REDACTED:secret]", 1],
      },
      redacted: true,
    });
  });

  it("preserves ordinary values exactly", () => {
    expect(redactSecretLikeValue({ source: "export const answer = 42;" })).toEqual({
      value: { source: "export const answer = 42;" },
      redacted: false,
    });
  });
});
