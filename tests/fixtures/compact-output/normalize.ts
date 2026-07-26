import { countTokens } from "../../../src/tokenizer.ts";

export function normalizeCompactOutputEnvelope(toolName: string, value: unknown, repoRoot: string): unknown {
  let normalized = normalize(value, repoRoot);
  if (toolName === "search_text" && normalized && typeof normalized === "object" && "data" in normalized && Array.isArray(normalized.data)) {
    normalized = { ...normalized, data: [...normalized.data].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))) };
  }
  if (normalized && typeof normalized === "object" && "data" in normalized && "meta" in normalized) {
    const envelope = normalized as { data: unknown; meta: Record<string, unknown> };
    return { ...envelope, meta: { ...envelope.meta, tokenBudgetUsed: countTokens(JSON.stringify(envelope.data)) } };
  }
  return normalized;
}
function normalize(value: unknown, root: string): unknown {
  if (typeof value === "string") return value.split(root).join("/fixture");
  if (Array.isArray(value)) return value.map((item) => normalize(item, root));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item, root)]));
  return value;
}
