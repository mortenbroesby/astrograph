import { get_encoding } from "tiktoken";
import { estimateTokenCount } from "tokenx";

export const BENCHMARK_TOKENIZER = "cl100k_base";
export const APPROXIMATE_BENCHMARK_TOKENIZER = "tokenx";

let encoder: ReturnType<typeof get_encoding> | null = null;

function getEncoder() {
  if (!encoder) {
    encoder = get_encoding(BENCHMARK_TOKENIZER);
  }

  return encoder;
}

export function countTokens(value: string): number {
  return getEncoder().encode(value).length;
}

export function estimateTokens(value: string): number {
  return estimateTokenCount(value);
}

export function disposeTokenizer() {
  encoder?.free();
  encoder = null;
}
