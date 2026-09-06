import path from "node:path";

import { parseWithTreeSitter } from "../parser/tree-sitter.ts";
import type { SupportedLanguage } from "../types/config.ts";
import {
  TREE_SITTER_JS_FAMILY_ADAPTERS,
  registerTreeSitterJsFamilyParseImplementation,
} from "./tree-sitter-js-family.ts";
import type { LanguageAdapter } from "./types.ts";

registerTreeSitterJsFamilyParseImplementation(parseWithTreeSitter);

export const LANGUAGE_ADAPTERS =
  TREE_SITTER_JS_FAMILY_ADAPTERS satisfies readonly LanguageAdapter[];

export type RegisteredLanguageAdapter = (typeof TREE_SITTER_JS_FAMILY_ADAPTERS)[number];

export const SUPPORTED_LANGUAGES = LANGUAGE_ADAPTERS.map(
  (adapter: RegisteredLanguageAdapter) => adapter.language,
) as SupportedLanguage[];

const LANGUAGE_ADAPTER_BY_LANGUAGE = new Map<
  SupportedLanguage,
  RegisteredLanguageAdapter
>(
  LANGUAGE_ADAPTERS.map(
    (adapter: RegisteredLanguageAdapter) => [adapter.language, adapter] as const,
  ),
);

const LANGUAGE_ADAPTER_BY_EXTENSION = new Map<string, RegisteredLanguageAdapter>();
for (const adapter of LANGUAGE_ADAPTERS) {
  for (const extension of adapter.extensions) {
    LANGUAGE_ADAPTER_BY_EXTENSION.set(extension, adapter);
  }
}

export function getSupportedLanguageAdapters(): readonly RegisteredLanguageAdapter[] {
  return LANGUAGE_ADAPTERS;
}

export function getLanguageAdapter(
  language: SupportedLanguage,
): RegisteredLanguageAdapter {
  const adapter = LANGUAGE_ADAPTER_BY_LANGUAGE.get(language);
  if (!adapter) {
    throw new Error(`Missing language adapter for ${language}`);
  }

  return adapter;
}

export function getLanguageAdapterForFile(
  filePath: string,
): RegisteredLanguageAdapter | null {
  return LANGUAGE_ADAPTER_BY_EXTENSION.get(path.extname(filePath).toLowerCase()) ?? null;
}
