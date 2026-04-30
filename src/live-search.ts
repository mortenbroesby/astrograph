import { spawn } from "node:child_process";
import path from "node:path";

import { rgPath } from "@vscode/ripgrep";

import type { SearchTextMatch } from "./types.ts";

export interface LiveSearchOptions {
  repoRoot: string;
  query: string;
  filePattern?: string;
  maxMatches?: number;
  maxOutputBytes?: number;
}

const DEFAULT_MAX_MATCHES = 50;
const DEFAULT_MAX_OUTPUT_BYTES = 256_000;

function normalizeLiveMatchPath(repoRoot: string, candidatePath: string): string | null {
  const absolutePath = path.resolve(repoRoot, candidatePath);
  const relativePath = path.relative(repoRoot, absolutePath);

  if (
    relativePath === ".."
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)
  ) {
    return null;
  }

  return relativePath;
}

export async function searchLiveText(
  options: LiveSearchOptions,
): Promise<SearchTextMatch[]> {
  const maxMatches = options.maxMatches ?? DEFAULT_MAX_MATCHES;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const args = [
    "--json",
    "--line-number",
    "--fixed-strings",
    "--color",
    "never",
    "--max-count",
    String(maxMatches),
  ];

  if (options.filePattern) {
    args.push("--glob", options.filePattern);
  }

  args.push(options.query, ".");

  return await new Promise<SearchTextMatch[]>((resolve, reject) => {
    const child = spawn(rgPath, args, {
      cwd: options.repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let killedForOutputLimit = false;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > maxOutputBytes) {
        killedForOutputLimit = true;
        child.kill("SIGTERM");
        return;
      }
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.once("error", reject);
    child.once("close", (code) => {
      if (killedForOutputLimit) {
        resolve([]);
        return;
      }
      if (code !== 0 && code !== 1) {
        reject(new Error(stderr.trim() || `ripgrep failed with exit code ${code}`));
        return;
      }

      const matches: SearchTextMatch[] = [];
      for (const line of stdout.split("\n")) {
        if (!line.trim()) {
          continue;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue;
        }

        if (
          typeof parsed !== "object"
          || parsed === null
          || (parsed as { type?: unknown }).type !== "match"
        ) {
          continue;
        }

        const data = (parsed as {
          data?: {
            path?: { text?: string };
            line_number?: number;
            lines?: { text?: string };
          };
        }).data;
        const candidatePath = data?.path?.text;
        const lineNumber = data?.line_number;
        const preview = data?.lines?.text?.trim();
        if (
          typeof candidatePath !== "string"
          || typeof lineNumber !== "number"
          || typeof preview !== "string"
        ) {
          continue;
        }

        const relativePath = normalizeLiveMatchPath(options.repoRoot, candidatePath);
        if (!relativePath) {
          continue;
        }

        matches.push({
          filePath: relativePath,
          line: lineNumber,
          preview,
          source: "live_disk_match",
          reason: "ripgrep_fallback",
        });

        if (matches.length >= maxMatches) {
          break;
        }
      }

      resolve(matches);
    });
  });
}
