#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const promptTemplatePath = path.join(repoRoot, "scripts", "ralph", "prompt.md");

function parseArgs(argv) {
  const args = {
    dir: "",
    agent: "",
    agentCommand: "",
    storyId: "",
    model: "",
    sandbox: "workspace-write",
    dryRun: false,
    autoCommit: false,
    enforceBranch: false,
    list: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--dir") {
      args.dir = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (token === "--agent") {
      args.agent = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (token === "--agent-command") {
      args.agentCommand = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (token === "--story") {
      args.storyId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (token === "--model") {
      args.model = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (token === "--sandbox") {
      args.sandbox = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (token === "--auto-commit") {
      args.autoCommit = true;
      continue;
    }

    if (token === "--enforce-branch") {
      args.enforceBranch = true;
      continue;
    }

    if (token === "--list") {
      args.list = true;
      continue;
    }
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function currentBranch() {
  return execFileSync("git", ["branch", "--show-current"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

function normalizePriority(priority) {
  const order = new Map([
    ["critical", 0],
    ["high", 1],
    ["medium", 2],
    ["low", 3],
  ]);

  if (typeof priority === "number") {
    return priority;
  }

  if (typeof priority === "string") {
    return order.get(priority.toLowerCase()) ?? 99;
  }

  return 99;
}

function normalizeStatus(story) {
  if (story?.passes === true) {
    return "done";
  }

  if (typeof story?.status === "string" && story.status.trim() !== "") {
    return story.status.trim().toLowerCase();
  }

  return "pending";
}

function validatePrd(prd) {
  const issues = [];

  if (!prd || typeof prd !== "object" || Array.isArray(prd)) {
    issues.push("`prd.json` must contain a JSON object.");
    return issues;
  }

  if (typeof prd.title !== "string" || prd.title.trim() === "") {
    issues.push("`title` must be a non-empty string.");
  }

  if (!Array.isArray(prd.stories) || prd.stories.length === 0) {
    issues.push("`stories` must be a non-empty array.");
    return issues;
  }

  const storyIds = new Set();

  prd.stories.forEach((story, index) => {
    const label = `stories[${index}]`;

    if (!story || typeof story !== "object" || Array.isArray(story)) {
      issues.push(`${label} must be an object.`);
      return;
    }

    if (typeof story.id !== "string" || story.id.trim() === "") {
      issues.push(`${label}.id must be a non-empty string.`);
    } else if (storyIds.has(story.id)) {
      issues.push(`${label}.id '${story.id}' is duplicated.`);
    } else {
      storyIds.add(story.id);
    }

    if (typeof story.title !== "string" || story.title.trim() === "") {
      issues.push(`${label}.title must be a non-empty string.`);
    }

    const status = normalizeStatus(story);
    const allowedStatuses = new Set(["pending", "in_progress", "blocked", "done"]);

    if (!allowedStatuses.has(status)) {
      issues.push(
        `${label}.status must be one of pending, in_progress, blocked, done.`,
      );
    }
  });

  return issues;
}

function pickNextStory(stories, storyId = "") {
  if (storyId) {
    return stories.find((story) => story?.id === storyId);
  }

  return stories
    .map((story, index) => ({ ...story, _index: index }))
    .filter((story) => normalizeStatus(story) !== "done")
    .sort((left, right) => {
      const statusOrder = new Map([
        ["in_progress", 0],
        ["pending", 1],
        ["blocked", 2],
        ["done", 3],
      ]);
      const statusDelta =
        (statusOrder.get(normalizeStatus(left)) ?? 99) -
        (statusOrder.get(normalizeStatus(right)) ?? 99);

      if (statusDelta !== 0) {
        return statusDelta;
      }

      const priorityDelta =
        normalizePriority(left.priority) - normalizePriority(right.priority);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return left._index - right._index;
    })[0];
}

function formatStories(stories) {
  return stories
    .map((story) => {
      const status = normalizeStatus(story);
      const priority = story.priority ?? "none";
      return `- ${story.id}: ${story.title} [status=${status}, priority=${priority}]`;
    })
    .join("\n");
}

function joinChecks(checks) {
  if (!Array.isArray(checks) || checks.length === 0) {
    return "- No explicit checks listed in `prd.json`. Use the narrowest relevant project checks.";
  }

  return checks.map((check) => `- ${check}`).join("\n");
}

function readRecentProgress(progressPath) {
  const raw = fs.readFileSync(progressPath, "utf8").trim();

  if (!raw) {
    return "No prior progress logged yet.";
  }

  const lines = raw.split("\n");
  const tail = lines.slice(-16).join("\n").trim();
  return tail || "No prior progress logged yet.";
}

function buildPrompt({
  template,
  runDir,
  prd,
  story,
  branch,
  autoCommit,
  recentProgress,
  storySummary,
}) {
  return template
    .replaceAll("{{RUN_DIR}}", runDir)
    .replaceAll("{{PRD_TITLE}}", prd.title || "Untitled Ralph Run")
    .replaceAll("{{BRANCH_NAME}}", prd.branchName || "(not specified)")
    .replaceAll("{{CURRENT_BRANCH}}", branch || "(detached)")
    .replaceAll("{{STORY_ID}}", story.id || "UNKNOWN")
    .replaceAll("{{STORY_TITLE}}", story.title || "Untitled story")
    .replaceAll("{{STORY_STATUS}}", normalizeStatus(story))
    .replaceAll(
      "{{STORY_NOTES}}",
      story.notes || "No additional story notes were provided.",
    )
    .replaceAll("{{STORY_SUMMARY}}", storySummary)
    .replaceAll("{{RECENT_PROGRESS}}", recentProgress)
    .replaceAll("{{CHECKS}}", joinChecks(prd.checks))
    .replaceAll(
      "{{COMMIT_POLICY}}",
      autoCommit
        ? [
            "If checks pass and the story is fully complete, commit all changes for this iteration.",
            "Commit message format: `feat: [Story ID] - [Story Title]`.",
          ].join("\n")
        : [
            "Do not commit automatically.",
            "Leave the worktree ready for human review after updating `prd.json` and `progress.txt`.",
          ].join("\n"),
    );
}

function writePrompt(runDirPath, prompt) {
  const stamp = new Date().toISOString().replaceAll(":", "-");
  let promptPath = path.join(runDirPath, `prompt-${stamp}.md`);
  let suffix = 1;

  while (fs.existsSync(promptPath)) {
    promptPath = path.join(runDirPath, `prompt-${stamp}-${suffix}.md`);
    suffix += 1;
  }

  fs.writeFileSync(promptPath, prompt, "utf8");
  return promptPath;
}

function writeLastRun(runDirPath, payload) {
  const lastRunPath = path.join(runDirPath, "last-run.json");
  fs.writeFileSync(lastRunPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return lastRunPath;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const relativeRunDir = args.dir || path.join(".ralph", "feature");
const absoluteRunDir = path.resolve(repoRoot, relativeRunDir);

if (!fs.existsSync(absoluteRunDir)) {
  fail(`Ralph run directory does not exist: ${relativeRunDir}`);
}

const prdPath = path.join(absoluteRunDir, "prd.json");
const progressPath = path.join(absoluteRunDir, "progress.txt");

if (!fs.existsSync(prdPath)) {
  fail(`Missing PRD file: ${path.relative(repoRoot, prdPath)}`);
}

if (!fs.existsSync(progressPath)) {
  fail(`Missing progress log: ${path.relative(repoRoot, progressPath)}`);
}

const prd = readJson(prdPath);
const issues = validatePrd(prd);

if (issues.length > 0) {
  fail(
    [
      "Invalid `prd.json`:",
      ...issues.map((issue) => `- ${issue}`),
    ].join("\n"),
  );
}

if (args.list) {
  console.log(`Stories in ${relativeRunDir}:`);
  console.log(formatStories(prd.stories));
  process.exit(0);
}

const story = pickNextStory(prd.stories, args.storyId);

if (!story) {
  if (args.storyId) {
    fail(`Story not found: ${args.storyId}`);
  }

  console.log(`No pending stories remain in ${relativeRunDir}`);
  process.exit(0);
}

if (normalizeStatus(story) === "done") {
  fail(`Story ${story.id} is already marked done.`);
}

const branch = currentBranch();

if (
  args.enforceBranch &&
  typeof prd.branchName === "string" &&
  prd.branchName.trim() !== "" &&
  prd.branchName !== branch
) {
  fail(
    [
      `Current branch ${branch} does not match PRD branch ${prd.branchName}.`,
      "Re-run on the intended branch or omit --enforce-branch.",
    ].join("\n"),
  );
}

const template = fs.readFileSync(promptTemplatePath, "utf8");
const recentProgress = readRecentProgress(progressPath);
const storySummary = formatStories(prd.stories);
const prompt = buildPrompt({
  template,
  runDir: relativeRunDir,
  prd,
  story,
  branch,
  autoCommit: args.autoCommit,
  recentProgress,
  storySummary,
});
const promptPath = writePrompt(absoluteRunDir, prompt);
const lastMessagePath = path.join(absoluteRunDir, "last-message.txt");
const lastRunPath = writeLastRun(absoluteRunDir, {
  generatedAt: new Date().toISOString(),
  branch,
  storyId: story.id,
  storyTitle: story.title,
  storyStatus: normalizeStatus(story),
  promptPath: path.relative(repoRoot, promptPath),
});

console.log(
  `Selected story: ${story.id} - ${story.title} [status=${normalizeStatus(story)}]`,
);
console.log(`Run directory: ${relativeRunDir}`);
console.log(`Prompt file: ${path.relative(repoRoot, promptPath)}`);
console.log(`Last run file: ${path.relative(repoRoot, lastRunPath)}`);
console.log(`Last message file: ${path.relative(repoRoot, lastMessagePath)}`);

function exitWithAgentResult(result, agentLabel) {
  const status = result.status ?? 1;

  if (status !== 0) {
    console.error(
      [
        `${agentLabel} exited with status ${status}.`,
        `Inspect ${path.relative(repoRoot, promptPath)} for the generated prompt.`,
        `Inspect ${path.relative(repoRoot, lastRunPath)} for run metadata.`,
        `Inspect ${path.relative(repoRoot, lastMessagePath)} if the agent wrote a final message.`,
      ].join("\n"),
    );
  }

  process.exit(status);
}

if (args.dryRun || (!args.agent && !args.agentCommand)) {
  console.log("Dry run only. Inspect the generated prompt file and re-run with an agent.");
  process.exit(0);
}

if (args.agentCommand) {
  const result = spawnSync(args.agentCommand, {
    cwd: repoRoot,
    shell: true,
    stdio: ["pipe", "inherit", "inherit"],
    input: prompt,
    encoding: "utf8",
  });

  exitWithAgentResult(result, "Custom agent command");
}

if (args.agent === "codex") {
  const codexArgs = [
    "exec",
    "--cd",
    repoRoot,
    "--sandbox",
    args.sandbox || "workspace-write",
    "--output-last-message",
    lastMessagePath,
    "-",
  ];

  if (args.model) {
    codexArgs.splice(1, 0, "--model", args.model);
  }

  const result = spawnSync("codex", codexArgs, {
    cwd: repoRoot,
    stdio: ["pipe", "inherit", "inherit"],
    input: prompt,
    encoding: "utf8",
  });

  exitWithAgentResult(result, "Codex");
}

if (args.agent === "claude") {
  const claudeArgs = [
    "-p",
    "--permission-mode",
    "acceptEdits",
    prompt,
  ];

  if (args.model) {
    claudeArgs.splice(1, 0, "--model", args.model);
  }

  const result = spawnSync("claude", claudeArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    encoding: "utf8",
  });

  exitWithAgentResult(result, "Claude");
}

fail(`Unsupported agent: ${args.agent}`);
