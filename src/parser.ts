import { getLanguageAdapter, getLanguageAdapterForFile } from "./languages/index.ts";
import type { ParsedFile, ParseSourceInput } from "./parser/shared.ts";
import type { SupportedLanguage } from "./types.ts";

export type { ParsedFile } from "./parser/shared.ts";

export function parseSourceFile(input: ParseSourceInput): ParsedFile {
  return getLanguageAdapter(input.language).parse(input);
}

export function supportedLanguageForFile(filePath: string): SupportedLanguage | null {
  return getLanguageAdapterForFile(filePath)?.language ?? null;
}
