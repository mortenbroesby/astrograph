import type { ParseSourceInput, ParsedFile } from "../parser/shared.ts";
import type { SummaryStrategy } from "../types/config.ts";
import type { SupportTier, TierToolAvailability } from "../types/retrieval.ts";

export type ParserBackendId = "tree-sitter";

export interface ParseBehaviorDescriptor {
  chunkRecoveryFallbackReason: string | null;
}

export interface LanguageAdapterMetadata<TLanguage extends string = string> {
  language: TLanguage;
  extensions: string[];
  tiers: SupportTier[];
  toolAvailability: TierToolAvailability;
  summaryStrategies: SummaryStrategy[];
  parserBackend: ParserBackendId;
  parseBehavior: ParseBehaviorDescriptor;
}

export interface LanguageAdapter<TLanguage extends string = string>
  extends LanguageAdapterMetadata<TLanguage> {
  parse(input: ParseSourceInput): ParsedFile;
}

export function defineLanguageAdapterMetadata<const TLanguage extends string>(
  metadata: LanguageAdapterMetadata<TLanguage>,
): LanguageAdapterMetadata<TLanguage> {
  return metadata;
}

export function defineLanguageAdapter<const TLanguage extends string>(
  adapter: LanguageAdapter<TLanguage>,
): LanguageAdapter<TLanguage> {
  return adapter;
}
