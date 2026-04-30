const REDACTED_SECRET = "[REDACTED:secret]";

const SECRET_VALUE_PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /AIza[0-9A-Za-z\-_]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
] as const;

export interface SecretLikeSourceHealth {
  secretLikeFileCount: number;
  sampleFilePaths: string[];
}

export function redactSecretLikeString(value: string): string {
  let nextValue = value;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    nextValue = nextValue.replace(pattern, REDACTED_SECRET);
  }
  return nextValue;
}

export function containsSecretLikeText(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}
