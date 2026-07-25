import { describe, expect, it } from "vitest";

import { TOKENIZER_RESEARCH_CORPUS } from "./fixtures/tokenizer-research-corpus.ts";
import {
  TOKENIZER_RESEARCH_CANDIDATES,
  runTokenizerResearchCandidate,
} from "../src/tokenizer-research.ts";

describe("tokenizer research benchmark", () => {
  it("keeps a locked corpus and reports deterministic counts for each candidate", async () => {
    expect(TOKENIZER_RESEARCH_CORPUS.map((corpusCase) => corpusCase.id)).toEqual([
      "task-context-json",
      "empty-envelope",
      "error-envelope",
      "provenance-heavy-json",
      "unicode-crlf-source",
      "large-repeated-source",
      "large-diverse-source",
    ]);

    const results = await Promise.all(
      TOKENIZER_RESEARCH_CANDIDATES.map((candidate) => runTokenizerResearchCandidate(candidate, 3)),
    );
    const exactReference = results.find((result) => result.candidate === "tiktoken-cl100k");
    expect(exactReference).toBeDefined();
    for (const result of results) {
      expect(Object.keys(result.counts)).toEqual(TOKENIZER_RESEARCH_CORPUS.map((corpusCase) => corpusCase.id));
      expect(result.warmLatencyMs.median).toBeGreaterThanOrEqual(0);
      expect(result.warmLatencyMs.p95).toBeGreaterThanOrEqual(result.warmLatencyMs.median);
    }
    expect(results.find((result) => result.candidate === "gpt-tokenizer-cl100k")?.counts)
      .toEqual(exactReference?.counts);
    expect(results.find((result) => result.candidate === "js-tiktoken-cl100k")?.counts)
      .toEqual(exactReference?.counts);
  });
});
