export interface TokenSavings {
  baselineTokens: number;
  returnedTokens: number;
  savedTokens: number;
}

export function extractTokenSavings(value: unknown): TokenSavings | null {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as { tokenSavings?: unknown }).tokenSavings;
  if (!candidate || typeof candidate !== "object") return null;
  const { baselineTokens, returnedTokens, savedTokens } = candidate as TokenSavings;
  if (![baselineTokens, returnedTokens, savedTokens].every((tokenCount) => Number.isSafeInteger(tokenCount) && tokenCount >= 0)) return null;
  return baselineTokens - returnedTokens === savedTokens
    ? { baselineTokens, returnedTokens, savedTokens }
    : null;
}
