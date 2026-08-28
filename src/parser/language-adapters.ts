import { Language, Parser } from "web-tree-sitter";
import { getWasmPath } from "tree-sitter-wasm";

import { LANGUAGE_SUPPORT_REGISTRY } from "../language-registry.ts";
import type { SupportedLanguage } from "../types.ts";
import type { ParserTraversal } from "../types.ts";

export interface LanguageAdapter {
  grammar: Language;
  traversal: ParserTraversal;
}

type GrammarName = Parameters<typeof getWasmPath>[0];

export const LANGUAGE_ADAPTERS: Record<
  SupportedLanguage,
  { grammar: GrammarName; traversal: ParserTraversal }
> = Object.fromEntries(
  LANGUAGE_SUPPORT_REGISTRY.map(({ language, grammar, traversal }) => [
    language,
    { grammar: grammar as GrammarName, traversal },
  ]),
) as Record<SupportedLanguage, { grammar: GrammarName; traversal: ParserTraversal }>;

const runtime = Parser.init();
const adapters = new Map<SupportedLanguage, Promise<LanguageAdapter>>();

export function getLanguageAdapter(language: SupportedLanguage): Promise<LanguageAdapter> {
  const cached = adapters.get(language);
  if (cached) return cached;

  const definition = LANGUAGE_ADAPTERS[language];
  const adapter = runtime.then(async () => ({
    grammar: await Language.load(getWasmPath(definition.grammar)),
    traversal: definition.traversal,
  }));
  adapters.set(language, adapter);
  return adapter;
}
