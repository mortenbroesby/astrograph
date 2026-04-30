import { afterEach, describe, expect, it } from "vitest";

import {
  APPROXIMATE_BENCHMARK_TOKENIZER,
  BENCHMARK_TOKENIZER,
  countTokens,
  disposeTokenizer,
  estimateTokens,
} from "../src/index.ts";

describe("benchmark tokenizer", () => {
  afterEach(() => {
    disposeTokenizer();
  });

  it("uses the cl100k_base tokenizer for exact token accounting", () => {
    expect(BENCHMARK_TOKENIZER).toBe("cl100k_base");
    expect(countTokens("hello world")).toBe(2);
    expect(
      countTokens(`export function area(radius: number): number {
  return radius * radius * 3.14;
}
`),
    ).toBe(21);
  });

  it("exposes tokenx as an approximate sidecar estimator", () => {
    expect(APPROXIMATE_BENCHMARK_TOKENIZER).toBe("tokenx");
    expect(estimateTokens("hello world")).toBeGreaterThan(0);
  });
});
