interface SerializeOptions {
  pretty?: boolean;
}

export function serializeToolResult(
  _toolName: string,
  value: unknown,
  options: SerializeOptions = {},
): string {
  return options.pretty
    ? JSON.stringify(value, null, 2)
    : JSON.stringify(value);
}
