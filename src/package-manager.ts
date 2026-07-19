import path from "node:path";

export interface PackageManagerInvocation {
  command: string;
  args: string[];
}

function quoteForWindowsCmd(value: string): string {
  return `"${value.replace(/(["^&|<>()])/g, "^$1")}"`;
}

export function packageManagerInvocation(
  command: string,
  args: readonly string[],
  platform = process.platform,
): PackageManagerInvocation {
  if (platform !== "win32") {
    return { command, args: [...args] };
  }

  // `cmd.exe` resolves a bare `.cmd` shim such as `pnpm` or `npm` through
  // PATH. Quoting that command token turns it into a literal name on Windows;
  // quote only the arguments, where whitespace and metacharacters matter.
  const commandLine = [command, ...args]
    .map((value, index) => (index === 0 ? value : quoteForWindowsCmd(value)))
    .join(" ");
  return {
    command: process.env.ComSpec ?? path.win32.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "cmd.exe"),
    args: ["/d", "/s", "/c", commandLine],
  };
}
