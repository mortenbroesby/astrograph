#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

function parseArgs(argv) {
  const args = {
    title: "",
    name: "",
    branch: "",
    dir: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--title") {
      args.title = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (token === "--name") {
      args.name = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (token === "--branch") {
      args.branch = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (token === "--dir") {
      args.dir = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
  }

  return args;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function ensureDir(absoluteDir) {
  fs.mkdirSync(absoluteDir, { recursive: true });
}

function writeIfMissing(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, "utf8");
  }
}

const args = parseArgs(process.argv.slice(2));
const seedName = args.name || args.title || "feature";
const slug = slugify(seedName) || "feature";
const relativeDir = args.dir || path.join(".ralph", slug);
const absoluteDir = path.resolve(repoRoot, relativeDir);

ensureDir(absoluteDir);

const prdPath = path.join(absoluteDir, "prd.json");
const progressPath = path.join(absoluteDir, "progress.txt");
const readmePath = path.join(absoluteDir, "README.md");

const prdTemplate = {
  title: args.title || "New Ralph Run",
  branchName: args.branch || "",
  checks: ["pnpm agents:check", "pnpm lint:md"],
  stories: [
    {
      id: "STORY-1",
      title: "Describe the first vertical slice",
      priority: "high",
      status: "pending",
      passes: false,
      notes: "Replace this placeholder with a concrete, verifiable story.",
    },
  ],
};

writeIfMissing(`${prdPath}`, `${JSON.stringify(prdTemplate, null, 2)}\n`);
writeIfMissing(
  progressPath,
  [
    "## Codebase Patterns",
    "- Add only reusable patterns here.",
    "",
    "## Run Log",
    "",
  ].join("\n"),
);
writeIfMissing(
  readmePath,
  [
    `# Ralph Run: ${prdTemplate.title}`,
    "",
    "Files in this directory:",
    "",
    "- `prd.json`: task state and story checklist",
    "- `progress.txt`: append-only learnings and iteration log",
    "- `last-run.json`: metadata for the most recently generated iteration",
    "- generated prompt/output files from `pnpm ralph:loop`",
    "",
    "Suggested next steps:",
    "",
    "1. Edit `prd.json` with concrete stories.",
    "2. Run `pnpm ralph:loop -- --dir "
      + relativeDir
      + " --list` to inspect story state.",
    "3. Run `pnpm ralph:loop -- --dir "
      + relativeDir
      + " --dry-run` to inspect the next prompt.",
    "4. Run `pnpm ralph:loop -- --dir "
      + relativeDir
      + " --agent codex` when the PRD is ready.",
    "",
  ].join("\n"),
);

console.log(`Initialized Ralph run in ${relativeDir}`);
console.log(`- ${path.relative(repoRoot, prdPath)}`);
console.log(`- ${path.relative(repoRoot, progressPath)}`);
console.log(`- ${path.relative(repoRoot, readmePath)}`);
