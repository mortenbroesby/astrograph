import { pathToFileURL } from "node:url";

/**
 * Determines whether an ESM module was invoked as the process entrypoint.
 *
 * `import.meta.url` is always a file URL, whereas `process.argv[1]` is a
 * native path. Constructing a file URL through string interpolation breaks on
 * Windows drive-letter paths, so every executable entrypoint shares this
 * conversion instead.
 */
export function isMainModule(
  moduleUrl: string,
  argvPath = process.argv[1],
): boolean {
  return argvPath !== undefined && moduleUrl === pathToFileURL(argvPath).href;
}
