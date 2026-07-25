import { execaSync, type SyncOptions } from "execa";

/**
 * Runs a script-support command with explicit, testable execa semantics.
 * This is intentionally internal: runtime subprocess management keeps its
 * existing specialized implementations.
 */
export function runProcess<OptionsType extends SyncOptions>(
  command: string,
  args: readonly string[] = [],
  options?: OptionsType,
) {
  return execaSync(command, args, options);
}
