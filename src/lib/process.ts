import { execaSync } from "execa";

interface CaptureProcessOptions {
  cwd?: string;
  timeout?: number;
  stderr?: "ignore" | "pipe";
}

export function captureProcess(
  command: string,
  args: readonly string[],
  options: CaptureProcessOptions = {},
): string {
  return execaSync(command, [...args], {
    cwd: options.cwd,
    timeout: options.timeout,
    stdin: "ignore",
    stdout: "pipe",
    stderr: options.stderr ?? "pipe",
  }).stdout.trim();
}

export function runProcessWithInheritedStdio(
  command: string,
  args: readonly string[],
  options: { shell?: boolean } = {},
): number {
  const result = execaSync(command, [...args], {
    stdio: "inherit",
    shell: options.shell,
    reject: false,
  });

  if (result.failed && result.exitCode === undefined) {
    throw result;
  }

  return result.exitCode ?? 1;
}
