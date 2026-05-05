import { z } from "zod";

import { getSupportedLanguages } from "./language-registry.ts";
import type {
  ContextBundleOptions,
  FindFilesOptions,
  FileSummaryOptions,
  ProjectStatusOptions,
  QueryCodeIntent,
  QueryCodeOptions,
  SearchTextOptions,
  SearchSymbolsOptions,
  SummaryStrategy,
  SupportedLanguage,
  SymbolKind,
} from "./types.ts";
import { SUMMARY_STRATEGIES } from "./types.ts";

const supportedLanguages = getSupportedLanguages();
const supportedLanguageSchema = z.enum(supportedLanguages as [
  SupportedLanguage,
  ...SupportedLanguage[],
]);
const symbolKindSchema = z.enum(["function", "class", "method", "constant", "type"]);
const summaryStrategySchema = z.enum(SUMMARY_STRATEGIES);
const queryCodeIntentSchema = z.enum(["discover", "source", "assemble", "auto"]);

const finiteNumberSchema = z.number().finite();
const positiveNumberSchema = finiteNumberSchema.refine((value) => value > 0, {
  message: "must be positive",
});
const nonNegativeNumberSchema = finiteNumberSchema.refine((value) => value >= 0, {
  message: "must be non-negative",
});

const cliNumberSchema = z.string().transform((value, ctx) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid numeric value: ${value}`,
    });
    return z.NEVER;
  }

  return parsed;
});

const nonEmptyTrimmedStringSchema = z.string().transform((value) => value.trim());
const nonEmptyOptionalStringSchema = nonEmptyTrimmedStringSchema
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const symbolIdsArraySchema = z
  .array(z.string())
  .transform((symbolIds) => symbolIds.map((symbolId) => symbolId.trim()).filter(Boolean))
  .optional();

const queryCodeOptionsSchema = z.object({
  repoRoot: z.string().min(1),
  intent: queryCodeIntentSchema.default("auto"),
  query: nonEmptyOptionalStringSchema,
  symbolId: nonEmptyOptionalStringSchema,
  symbolIds: symbolIdsArraySchema,
  filePath: nonEmptyOptionalStringSchema,
  kind: symbolKindSchema.optional(),
  language: supportedLanguageSchema.optional(),
  filePattern: nonEmptyOptionalStringSchema,
  limit: positiveNumberSchema.optional(),
  contextLines: nonNegativeNumberSchema.optional(),
  verify: z.boolean().optional(),
  tokenBudget: positiveNumberSchema.optional(),
  includeTextMatches: z.boolean().optional(),
  includeRankedCandidates: z.boolean().optional(),
  includeDependencies: z.boolean().optional(),
  includeImporters: z.boolean().optional(),
  includeReferences: z.boolean().optional(),
  relationDepth: positiveNumberSchema.max(3).optional(),
}).superRefine((input, ctx) => {
  const resolvedIntent = resolveQueryCodeIntent(input);

  if (resolvedIntent === "discover" && !input.query) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: input.intent === "auto"
        ? "query_code auto intent resolved to discover and requires a non-empty query"
        : "query_code discover intent requires a non-empty query",
      path: ["query"],
    });
  }

  if (
    resolvedIntent === "source" &&
    !input.filePath &&
    !input.symbolId &&
    (!input.symbolIds || input.symbolIds.length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: input.intent === "auto"
        ? "query_code auto intent resolved to source and requires filePath, symbolId, or symbolIds"
        : "query_code source intent requires filePath, symbolId, or symbolIds",
    });
  }

  if (
    resolvedIntent === "assemble" &&
    !input.query &&
    (!input.symbolIds || input.symbolIds.length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: input.intent === "auto"
        ? "query_code auto intent resolved to assemble and requires a non-empty query or symbolIds"
        : "query_code assemble intent requires a non-empty query or symbolIds",
    });
  }
});

function resolveQueryCodeIntent(
  input: Pick<
    QueryCodeOptions,
    "intent" | "symbolId" | "symbolIds" | "filePath" | "tokenBudget" | "includeRankedCandidates"
  >,
): Exclude<QueryCodeIntent, "auto"> {
  if (input.intent && input.intent !== "auto") {
    return input.intent;
  }

  if (input.filePath || input.symbolId) {
    return "source";
  }

  if (input.tokenBudget !== undefined || input.includeRankedCandidates) {
    return "assemble";
  }

  if (input.symbolIds && input.symbolIds.length > 0) {
    return "source";
  }

  return "discover";
}

function optionalCliString(args: Record<string, string>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function trimToOptional(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeZodError(
  error: z.ZodError,
  fallbackMessage: string,
): string {
  return error.issues[0]?.message ?? fallbackMessage;
}

export function parseCliOptionalNumber(
  args: Record<string, string>,
  key: string,
): number | undefined {
  const value = args[key];
  if (!value) {
    return undefined;
  }

  const parsed = cliNumberSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid numeric argument --${key}: ${value}`);
  }

  return parsed.data;
}

export function parseMcpOptionalNumber(
  params: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = params[key];
  if (value === undefined) {
    return undefined;
  }

  const parsed = finiteNumberSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid numeric argument: ${key}`);
  }

  return parsed.data;
}

export function requirePositiveNumber(value: number, name: string): number {
  const parsed = positiveNumberSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`${name} must be positive`);
  }

  return parsed.data;
}

export function requireNonNegativeNumber(value: number, name: string): number {
  const parsed = nonNegativeNumberSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`${name} must be non-negative`);
  }

  return parsed.data;
}

export function validateSearchSymbolsOptions(
  input: Pick<SearchSymbolsOptions, "limit">,
): void {
  if (input.limit !== undefined) {
    requirePositiveNumber(input.limit, "limit");
  }
}

function trimRequiredString(value: string | undefined, message: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(message);
  }
  return trimmed;
}

export function validateFindFilesOptions(
  input: Pick<FindFilesOptions, "query" | "filePattern" | "limit">,
): Pick<FindFilesOptions, "query" | "filePattern"> {
  if (input.limit !== undefined) {
    requirePositiveNumber(input.limit, "limit");
  }

  const query = trimToOptional(input.query);
  const filePattern = trimToOptional(input.filePattern);
  if (!query && !filePattern) {
    throw new Error("find_files requires a non-empty query or filePattern");
  }

  return {
    query,
    filePattern,
  };
}

export function validateSearchTextOptions(
  input: Pick<SearchTextOptions, "query" | "limit">,
): void {
  trimRequiredString(input.query, "search_text requires a non-empty query");
  if (input.limit !== undefined) {
    requirePositiveNumber(input.limit, "limit");
  }
}

export function validateFileSummaryOptions(
  input: Pick<FileSummaryOptions, "filePath">,
): void {
  trimRequiredString(input.filePath, "get_file_summary requires a non-empty filePath");
}

export function validateProjectStatusOptions(
  _input: Pick<ProjectStatusOptions, "scanFreshness">,
): void {
  // Reserved for future expansion of project status filters.
}

export function normalizeContextBundleSeeds(
  input: Pick<ContextBundleOptions, "query" | "symbolIds">,
): Pick<ContextBundleOptions, "query" | "symbolIds"> {
  const query = trimToOptional(input.query);
  const symbolIds = input.symbolIds
    ?.map((symbolId) => symbolId.trim())
    .filter(Boolean);

  if (!query && (!symbolIds || symbolIds.length === 0)) {
    throw new Error("getContextBundle requires a non-empty query or symbolIds");
  }

  return {
    query,
    symbolIds,
  };
}

export function validateContextBundleOptions(
  input: Pick<ContextBundleOptions, "query" | "symbolIds" | "tokenBudget">,
): Pick<ContextBundleOptions, "query" | "symbolIds"> {
  if (input.tokenBudget !== undefined) {
    requirePositiveNumber(input.tokenBudget, "tokenBudget");
  }

  return normalizeContextBundleSeeds(input);
}

export function validateRankedContextOptions(input: {
  tokenBudget?: number;
}): void {
  if (input.tokenBudget !== undefined) {
    requirePositiveNumber(input.tokenBudget, "tokenBudget");
  }
}

export function validateSymbolSourceOptions(input: {
  contextLines?: number;
}): void {
  if (input.contextLines !== undefined) {
    requireNonNegativeNumber(input.contextLines, "contextLines");
  }
}

export function parseCliSupportedLanguage(
  args: Record<string, string>,
  key: string,
): SupportedLanguage | undefined {
  const value = optionalCliString(args, key);
  if (!value) {
    return undefined;
  }

  const parsed = supportedLanguageSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Unsupported --${key}: ${value}. Expected one of: ${supportedLanguages.join(", ")}`,
    );
  }

  return parsed.data;
}

export function parseCliSymbolKind(
  args: Record<string, string>,
  key: string,
): SymbolKind | undefined {
  const value = optionalCliString(args, key);
  if (!value) {
    return undefined;
  }

  const parsed = symbolKindSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Unsupported --${key}: ${value}. Expected one of: function, class, method, constant, type`,
    );
  }

  return parsed.data;
}

export function parseCliSummaryStrategy(
  args: Record<string, string>,
  key: string,
): SummaryStrategy | undefined {
  const value = optionalCliString(args, key);
  if (!value) {
    return undefined;
  }

  const parsed = summaryStrategySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Unsupported --${key}: ${value}. Expected one of: ${SUMMARY_STRATEGIES.join(", ")}`,
    );
  }

  return parsed.data;
}

export function parseQueryCodeCliInput(args: Record<string, string>): QueryCodeOptions {
  const rawInput = {
    repoRoot: args.repo,
    intent: args.intent,
    query: optionalCliString(args, "query"),
    symbolId: optionalCliString(args, "symbol"),
    symbolIds: optionalCliString(args, "symbols")?.split(","),
    filePath: optionalCliString(args, "file"),
    kind: parseCliSymbolKind(args, "kind"),
    language: parseCliSupportedLanguage(args, "language"),
    filePattern: optionalCliString(args, "file-pattern"),
    limit: parseCliOptionalNumber(args, "limit"),
    contextLines: parseCliOptionalNumber(args, "context-lines"),
    verify: args.verify === "true",
    tokenBudget: parseCliOptionalNumber(args, "budget"),
    includeTextMatches: args["include-text"] === "true",
    includeRankedCandidates: args["include-ranked"] === "true",
    includeDependencies: args["include-dependencies"] === "true",
    includeImporters: args["include-importers"] === "true",
    includeReferences: args["include-references"] === "true",
    relationDepth: parseCliOptionalNumber(args, "relation-depth"),
  };

  const parsed = queryCodeOptionsSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(normalizeZodError(parsed.error, "Invalid query-code arguments"));
  }

  return parsed.data;
}
