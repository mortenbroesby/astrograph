import {
  supportedLanguageForFile as supportedLanguageForFileFromRegistry,
} from "./language-registry.ts";
import { parseWithTreeSitter } from "./parser/tree-sitter.ts";
import type { ParsedFile, ParseSourceInput } from "./parser/shared.ts";
import type { SupportedLanguage } from "./types.ts";

export type { ParsedFile } from "./parser/shared.ts";

export function parseSourceFile(input: ParseSourceInput): ParsedFile {
  return parseWithTreeSitter(input);
}

export function supportedLanguageForFile(filePath: string): SupportedLanguage | null {
  return supportedLanguageForFileFromRegistry(filePath);
}
