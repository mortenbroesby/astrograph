import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { clearStorageProcessCaches } from "../../../src/index.ts";

export type CompactOutputFixtureName = "small-frontend" | "product-monorepo" | "text-heavy-workspace" | "dead-code-workspace";
export interface CompactOutputFixture { name: CompactOutputFixtureName; repoRoot: string; outlinePath: string; symbolQuery: string; textQuery: string; }

const created: string[] = [];
async function write(root: string, file: string, body: string) {
  const target = path.join(root, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
}

async function createFiles(root: string, name: CompactOutputFixtureName) {
  await Promise.all([
    write(root, "astrograph.config.json", JSON.stringify({ storageLocation: "repo-local" })),
    write(root, "README.md", "# Compact output fixture\n\nTODO: deterministic corpus.\n"),
  ]);
  if (name === "small-frontend") {
    await Promise.all([
      write(root, "src/main.tsx", 'import { Button } from "./Button"; export function App() { return <Button />; }\n'),
      write(root, "src/Button.tsx", "export function Button() { return <button>Save</button>; }\n"),
      write(root, "src/theme.css", ":root { color: #334; }\n"),
      write(root, "tests/Button.test.tsx", "export const testName = 'Button';\n"),
    ]);
    return;
  }
  if (name === "product-monorepo") {
    const writes: Promise<void>[] = [write(root, "openapi/catalog.yaml", "openapi: 3.0.0\ninfo:\n  title: Catalog\n")];
    for (let index = 1; index <= 24; index += 1) writes.push(write(root, `apps/web/src/Feature${index}.tsx`, `export function Feature${index}Page() { return <main>Feature ${index}</main>; }\n`));
    for (let index = 1; index <= 20; index += 1) {
      writes.push(write(root, `services/catalog/src/Catalog${index}.cs`, `namespace Catalog; public class Catalog${index} { public string Handle() => "catalog-${index}"; }\n`));
      writes.push(write(root, `services/orders/src/main/java/Order${index}.java`, `public class Order${index} { public String process() { return "order-${index}"; } }\n`));
    }
    await Promise.all(writes);
    return;
  }
  if (name === "text-heavy-workspace") {
    const writes: Promise<void>[] = [];
    for (let index = 1; index <= 32; index += 1) writes.push(write(root, `docs/topic-${index}.md`, `# Topic ${index}\n\n${"Workspace documentation: café, quotes, and Unicode ✨.\n".repeat(24)}`));
    await Promise.all(writes);
    return;
  }
  const writes: Promise<void>[] = [];
  for (let index = 1; index <= 60; index += 1) writes.push(write(root, `src/${index <= 16 ? "active" : "legacy"}/Feature${index}.ts`, `export function feature${index}() { return "unused-${index}"; }\n`));
  for (let index = 1; index <= 20; index += 1) writes.push(write(root, `services/Legacy${index}.cs`, `namespace Legacy; public class Legacy${index} { public int Run() => ${index}; }\n`));
  await Promise.all(writes);
}

export async function createCompactOutputFixture(name: CompactOutputFixtureName): Promise<CompactOutputFixture> {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), `astrograph-compact-${name}-`));
  created.push(repoRoot);
  await createFiles(repoRoot, name);
  execFileSync("git", ["init"], { cwd: repoRoot, stdio: ["ignore", "ignore", "ignore"] });
  const cases: Record<CompactOutputFixtureName, Omit<CompactOutputFixture, "name" | "repoRoot">> = {
    "small-frontend": { outlinePath: "src/Button.tsx", symbolQuery: "Button", textQuery: "Save" },
    "product-monorepo": { outlinePath: "apps/web/src/Feature1.tsx", symbolQuery: "Order", textQuery: "catalog" },
    "text-heavy-workspace": { outlinePath: "docs/topic-1.md", symbolQuery: "Topic", textQuery: "workspace" },
    "dead-code-workspace": { outlinePath: "src/active/Feature1.ts", symbolQuery: "Feature", textQuery: "unused" },
  };
  return { name, repoRoot, ...cases[name] };
}

export async function cleanupCompactOutputFixtures() {
  clearStorageProcessCaches();
  await Promise.all(created.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
}
