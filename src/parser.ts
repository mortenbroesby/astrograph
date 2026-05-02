import {
  supportedLanguageForFile as supportedLanguageForFileFromRegistry,
} from "./language-registry.ts";
import { parseWithOxc } from "./parser/oxc.ts";
import { parseWithTreeSitter } from "./parser/tree-sitter.ts";
import type { ParsedFile, ParseSourceInput } from "./parser/shared.ts";
import type { SupportedLanguage } from "./types.ts";

export type { ParsedFile } from "./parser/shared.ts";

export function parseSourceFile(input: ParseSourceInput): ParsedFile {
  try {
    return parseWithOxc(input);
  } catch (error) {
    return parseWithTreeSitter({
      ...input,
      fallbackReason: error instanceof Error ? error.message : String(error),
    });
  }
}

export function supportedLanguageForFile(filePath: string): SupportedLanguage | null {
  return supportedLanguageForFileFromRegistry(filePath);
}
