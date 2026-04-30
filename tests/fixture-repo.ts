import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { clearStorageProcessCaches } from "../src/index.ts";

const createdDirs: string[] = [];

export async function createFixtureRepo(options: {
  includeIgnoredFile?: boolean;
} = {}): Promise<string> {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "ai-context-engine-"));
  createdDirs.push(repoRoot);

  await mkdir(path.join(repoRoot, "src"), { recursive: true });
  await mkdir(path.join(repoRoot, "scripts"), { recursive: true });

  await writeFile(
    path.join(repoRoot, "src", "math.ts"),
    `import { formatLabel } from "./strings.js";

export const PI = 3.14;

/** Calculate the circle area label. */
export function area(radius: number): string {
  const value = PI * radius * radius;
  return formatLabel(value);
}
`,
  );

  await writeFile(
    path.join(repoRoot, "src", "strings.ts"),
    `// Format an area label for display.
export function formatLabel(value: number): string {
  return \`Area: \${value.toFixed(2)}\`;
}

/** Friendly greeter for string output. */
export class Greeter {
  // Return a greeting for the provided name.
  greet(name: string): string {
    return "Hello " + name;
  }
}
`,
  );

  await writeFile(
    path.join(repoRoot, "scripts", "ignored.txt"),
    "not code",
  );

  if (options.includeIgnoredFile) {
    await writeFile(path.join(repoRoot, ".gitignore"), "src/ignored.ts\n");
    await writeFile(
      path.join(repoRoot, "src", "ignored.ts"),
      "export const ignored = true;\n",
    );
  }

  execFileSync("git", ["init"], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "ignore"],
  });

  return repoRoot;
}

export async function cleanupFixtureRepos() {
  clearStorageProcessCaches();
  await Promise.all(
    createdDirs.splice(0).map(async (dir) => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          await rm(dir, { recursive: true, force: true });
          return;
        } catch (error) {
          if (
            !(error instanceof Error)
            || !("code" in error)
            || (error.code !== "ENOTEMPTY" && error.code !== "EBUSY")
            || attempt === 4
          ) {
            throw error;
          }
          await delay(50 * (attempt + 1));
        }
      }
    }),
  );
}
