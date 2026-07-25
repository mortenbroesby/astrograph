import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { clearStorageProcessCaches } from "../../../src/index.ts";

export type CompactOutputFixtureName =
  | "small-frontend"
  | "product-monorepo"
  | "text-heavy-workspace"
  | "dead-code-workspace";

export interface CompactOutputFixture {
  name: CompactOutputFixtureName;
  repoRoot: string;
  outlinePath: string;
  symbolQuery: string;
  textQuery: string;
}

const createdDirs: string[] = [];

async function writeRepoFile(repoRoot: string, filePath: string, contents: string) {
  const target = path.join(repoRoot, filePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

async function writeBaseFiles(repoRoot: string) {
  await writeRepoFile(
    repoRoot,
    "astrograph.config.json",
    JSON.stringify({ storageLocation: "repo-local" }),
  );
  await writeRepoFile(repoRoot, "README.md", "# Fixture workspace\n\nTODO: benchmark compact output.\n");
}

async function buildSmallFrontend(repoRoot: string) {
  await Promise.all([
    writeRepoFile(repoRoot, "package.json", '{"name":"small-frontend","private":true}\n'),
    writeRepoFile(repoRoot, "src/main.tsx", 'import { Button } from "./components/Button";\nexport function App() { return <Button label="Save" />; }\n'),
    writeRepoFile(repoRoot, "src/components/Button.tsx", "export function Button({ label }: { label: string }) { return <button>{label}</button>; }\n"),
    writeRepoFile(repoRoot, "src/components/Dialog.tsx", "export function Dialog({ title }: { title: string }) { return <dialog>{title}</dialog>; }\n"),
    writeRepoFile(repoRoot, "src/api/client.ts", "export async function loadDashboard() { return fetch('/api/dashboard'); }\n"),
    writeRepoFile(repoRoot, "src/state/session.ts", "export const sessionState = { signedIn: false };\n"),
    writeRepoFile(repoRoot, "src/styles/theme.css", ":root { color: #334; }\n"),
    writeRepoFile(repoRoot, "tests/Button.test.tsx", "export const buttonTestName = 'Button renders';\n"),
  ]);
}

async function buildProductMonorepo(repoRoot: string) {
  const writes: Promise<void>[] = [
    writeRepoFile(repoRoot, "pnpm-workspace.yaml", "packages:\n  - apps/*\n  - services/*\n"),
    writeRepoFile(repoRoot, "openapi/catalog.yaml", "openapi: 3.0.0\ninfo:\n  title: Catalog API\n"),
    writeRepoFile(repoRoot, "docs/architecture.md", "# Product architecture\n\nTODO: document service boundaries.\n"),
  ];
  for (let index = 1; index <= 24; index += 1) {
    writes.push(writeRepoFile(
      repoRoot,
      `apps/web/src/features/Feature${index}.tsx`,
      `export function Feature${index}Page() { return <main>Feature ${index}</main>; }\n`,
    ));
  }
  for (let index = 1; index <= 20; index += 1) {
    writes.push(writeRepoFile(
      repoRoot,
      `services/catalog/src/Handlers/CatalogHandler${index}.cs`,
      `namespace Catalog.Handlers; public class CatalogHandler${index} { public string Handle() => "catalog-${index}"; }\n`,
    ));
    writes.push(writeRepoFile(
      repoRoot,
      `services/orders/src/main/java/com/astrograph/orders/OrderService${index}.java`,
      `package com.astrograph.orders; public class OrderService${index} { public String process() { return "order-${index}"; } }\n`,
    ));
  }
  await Promise.all(writes);
}

async function buildTextHeavyWorkspace(repoRoot: string) {
  const writes: Promise<void>[] = [
    writeRepoFile(repoRoot, "docs/guide.md", "# Workspace guide\n\nThis workspace contains long-form documentation: café, \"quoted\" values, commas, and tabs\t. TODO: add examples.\n"),
  ];
  for (let index = 1; index <= 12; index += 1) {
    writes.push(writeRepoFile(
      repoRoot,
      `docs/reference/topic-${index}.md`,
      `# Topic ${index}\n\n${"The workspace documentation explains configuration, operational context, and Unicode café ✨.\n".repeat(24)}`,
    ));
    writes.push(writeRepoFile(
      repoRoot,
      `config/environments/environment-${index}.yaml`,
      `name: environment-${index}\ndescription: workspace configuration ${index}\nflags:\n  compactOutput: true\n`,
    ));
  }
  for (let index = 1; index <= 8; index += 1) {
    writes.push(writeRepoFile(
      repoRoot,
      `content/catalog-${index}.json`,
      JSON.stringify({ title: `Workspace catalog ${index}`, body: "documentation ".repeat(80) }),
    ));
  }
  await Promise.all(writes);
}

async function buildDeadCodeWorkspace(repoRoot: string) {
  const writes: Promise<void>[] = [
    writeRepoFile(repoRoot, "src/entry.ts", "import { activeFeature } from './active/feature.js'; export const start = activeFeature();\n"),
  ];
  for (let index = 1; index <= 16; index += 1) {
    writes.push(writeRepoFile(repoRoot, `src/active/feature-${index}.ts`, `export function activeFeature${index}() { return "active-${index}"; }\n`));
  }
  for (let index = 1; index <= 44; index += 1) {
    writes.push(writeRepoFile(repoRoot, `src/legacy/unused-${index}.ts`, `export function unusedFeature${index}() { return "unused-${index}"; }\n`));
  }
  for (let index = 1; index <= 18; index += 1) {
    writes.push(writeRepoFile(repoRoot, `services/legacy/LegacyWorker${index}.cs`, `namespace Legacy; public class LegacyWorker${index} { public int Run() => ${index}; }\n`));
    writes.push(writeRepoFile(repoRoot, `services/legacy-java/src/main/java/LegacyJob${index}.java`, `public class LegacyJob${index} { public int run() { return ${index}; } }\n`));
  }
  await Promise.all(writes);
}

export async function createCompactOutputFixture(name: CompactOutputFixtureName): Promise<CompactOutputFixture> {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), `astrograph-compact-${name}-`));
  createdDirs.push(repoRoot);
  await writeBaseFiles(repoRoot);

  if (name === "small-frontend") await buildSmallFrontend(repoRoot);
  if (name === "product-monorepo") await buildProductMonorepo(repoRoot);
  if (name === "text-heavy-workspace") await buildTextHeavyWorkspace(repoRoot);
  if (name === "dead-code-workspace") await buildDeadCodeWorkspace(repoRoot);

  execFileSync("git", ["init"], { cwd: repoRoot, stdio: ["ignore", "ignore", "ignore"] });
  const scenarios: Record<CompactOutputFixtureName, Omit<CompactOutputFixture, "name" | "repoRoot">> = {
    "small-frontend": { outlinePath: "src/components/Button.tsx", symbolQuery: "Button", textQuery: "label" },
    "product-monorepo": { outlinePath: "apps/web/src/features/Feature1.tsx", symbolQuery: "Service", textQuery: "catalog" },
    "text-heavy-workspace": { outlinePath: "docs/guide.md", symbolQuery: "guide", textQuery: "workspace" },
    "dead-code-workspace": { outlinePath: "src/active/feature-1.ts", symbolQuery: "Feature", textQuery: "unused" },
  };
  return { name, repoRoot, ...scenarios[name] };
}

export async function cleanupCompactOutputFixtures() {
  clearStorageProcessCaches();
  await Promise.all(createdDirs.splice(0).map(async (dir) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await rm(dir, { recursive: true, force: true });
        return;
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOTEMPTY" || attempt === 4) {
          throw error;
        }
        await delay(50 * (attempt + 1));
      }
    }
  }));
}
