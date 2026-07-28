import { Language, Parser } from "web-tree-sitter";
import { getWasmPath } from "tree-sitter-wasm";

import type { SupportedLanguage } from "../types.ts";

export type AdapterTraversal = "javascript" | "structured";

export interface LanguageAdapter {
  grammar: Language;
  traversal: AdapterTraversal;
}

type GrammarName = Parameters<typeof getWasmPath>[0];

export const LANGUAGE_ADAPTERS: Record<
  SupportedLanguage,
  { grammar: GrammarName; traversal: AdapterTraversal }
> = {
  ts: { grammar: "typescript", traversal: "javascript" },
  tsx: { grammar: "tsx", traversal: "javascript" },
  js: { grammar: "javascript", traversal: "javascript" },
  jsx: { grammar: "javascript", traversal: "javascript" },
  python: { grammar: "python", traversal: "structured" },
  bash: { grammar: "bash", traversal: "structured" },
  powershell: { grammar: "powershell", traversal: "structured" },
  csharp: { grammar: "c_sharp", traversal: "structured" },
  java: { grammar: "java", traversal: "structured" },
  go: { grammar: "go", traversal: "structured" },
  rust: { grammar: "rust", traversal: "structured" },
  json: { grammar: "json", traversal: "structured" },
  html: { grammar: "html", traversal: "structured" },
  css: { grammar: "css", traversal: "structured" },
  c: { grammar: "c", traversal: "structured" },
  cpp: { grammar: "cpp", traversal: "structured" },
  php: { grammar: "php", traversal: "structured" },
  ruby: { grammar: "ruby", traversal: "structured" },
  template: { grammar: "embedded_template", traversal: "structured" },
  scala: { grammar: "scala", traversal: "structured" },
};

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
