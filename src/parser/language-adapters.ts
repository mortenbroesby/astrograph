import Parser from "tree-sitter";
import bash from "tree-sitter-bash";
import c from "tree-sitter-c";
import csharp from "tree-sitter-c-sharp";
import cpp from "tree-sitter-cpp";
import css from "tree-sitter-css";
import go from "tree-sitter-go";
import html from "tree-sitter-html";
import javascript from "tree-sitter-javascript";
import java from "tree-sitter-java";
import json from "tree-sitter-json";
import phpBundle from "tree-sitter-php";
import powershell from "tree-sitter-powershell";
import python from "tree-sitter-python";
import ruby from "tree-sitter-ruby";
import rust from "tree-sitter-rust";
import scala from "tree-sitter-scala";
import template from "tree-sitter-embedded-template";
import tsLanguages from "tree-sitter-typescript";

import type { SupportedLanguage } from "../types.ts";

export type AdapterTraversal = "javascript" | "structured";

export interface LanguageAdapter {
  grammar: Parser.Language;
  traversal: AdapterTraversal;
}

const structured = (grammar: unknown): LanguageAdapter => ({
  grammar: grammar as Parser.Language,
  traversal: "structured",
});

const javascriptFamily = (grammar: unknown): LanguageAdapter => ({
  grammar: grammar as Parser.Language,
  traversal: "javascript",
});

export const LANGUAGE_ADAPTERS: Record<SupportedLanguage, LanguageAdapter> = {
  ts: javascriptFamily(tsLanguages.typescript),
  tsx: javascriptFamily(tsLanguages.tsx),
  js: javascriptFamily(javascript),
  jsx: javascriptFamily(javascript),
  python: structured(python),
  bash: structured(bash),
  powershell: structured(powershell),
  csharp: structured(csharp),
  java: structured(java),
  go: structured(go),
  rust: structured(rust),
  json: structured(json),
  html: structured(html),
  css: structured(css),
  c: structured(c),
  cpp: structured(cpp),
  php: structured(phpBundle.php),
  ruby: structured(ruby),
  template: structured(template),
  scala: structured(scala),
};
