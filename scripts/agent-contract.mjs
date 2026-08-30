#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const skillsRoot = path.join(repoRoot, ".skills");

function skillEntries() {
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(skillsRoot, entry.name, "SKILL.md"),
    }))
    .filter((entry) => {
      try {
        readFileSync(entry.path, "utf8");
        return true;
      } catch {
        return false;
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function findSkill(name) {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(name)) {
    throw new Error(`Invalid skill name: ${name}`);
  }
  const skill = skillEntries().find((entry) => entry.name === name);
  if (!skill) throw new Error(`Unknown skill: ${name}`);
  return skill;
}

function commandFor(event, matcher) {
  const hooks = JSON.parse(readFileSync(path.join(repoRoot, ".codex", "hooks.json"), "utf8")).hooks;
  return hooks?.[event]?.some((group) => group.matcher === matcher && group.hooks?.some((hook) => hook.command.includes(".agents/hooks.mjs")));
}

function checkContract() {
  const packageVersion = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")).version;
  const config = readFileSync(path.join(repoRoot, ".codex", "config.toml"), "utf8");
  const managed = config.match(/# BEGIN ASTROGRAPH[\s\S]*?# END ASTROGRAPH/);
  const expectedInvocation = `"astrograph@${packageVersion}"`;

  if (!managed) throw new Error("Missing managed Astrograph MCP block.");
  if (!managed[0].includes(expectedInvocation)) {
    throw new Error(`Tracked Codex MCP version must match package.json (${packageVersion}).`);
  }
  if (/^\[mcp_servers\.(?!astrograph\])/m.test(config.replace(managed[0], ""))) {
    throw new Error("Repo-local Codex config must contain only the managed Astrograph MCP server.");
  }
  for (const [event, matcher] of [["SessionStart", "startup|resume|clear|compact"], ["PreToolUse", "^Bash$"], ["PreToolUse", "^apply_patch$"], ["PostToolUse", "^apply_patch$"]]) {
    if (!commandFor(event, matcher)) throw new Error(`Missing ${event} hook for ${matcher}.`);
  }
  if (!commandFor("UserPromptSubmit", undefined) || !commandFor("Stop", undefined)) {
    throw new Error("Missing UserPromptSubmit or Stop hook.");
  }
  if (readFileSync(path.join(repoRoot, ".agents", "settings.cjs"), "utf8").includes("allowDirectMainPush: true")) {
    throw new Error("Direct pushes to main must remain disabled.");
  }
  const rules = readFileSync(path.join(repoRoot, ".codex", "rules", "safety.rules"), "utf8");
  for (const requiredRule of ["git\", \"reset\", \"--hard", "git\", \"clean", "npm\", \"pnpm", "git\", \"push\", \"origin"]) {
    if (!rules.includes(requiredRule)) throw new Error(`Missing Codex safety rule: ${requiredRule}`);
  }
  if (skillEntries().length === 0) throw new Error("No repo-owned skills found.");

  console.log("Agent contract OK.");
}

function route(query) {
  const text = query.toLowerCase();
  const routes = [
    [/\b(debug|bug|failure|error|broken)\b/, "debugging-and-error-recovery"],
    [/\b(test|regression|behavior)\b/, "test-driven-development"],
    [/\b(unclear|uncertain|assumptions?|explore|investigate|stress-test|questions?)\b/, "openspec-explore"],
    [/\b(plan|breakdown|milestone|spec|adr|architecture)\b/, "openspec-propose"],
    [/\b(release|publish|version)\b/, "release-decision"],
    [/\b(review|quality|verify)\b/, "verification-before-completion"],
  ];
  const names = [...new Set(routes.filter(([pattern]) => pattern.test(text)).map(([, name]) => name))];
  console.log((names.length ? names : ["engineering-workflow"]).join("\n"));
}

const [command, ...args] = process.argv.slice(2);

try {
  if (command === "check") checkContract();
  else if (command === "skills:list") console.log(skillEntries().map((entry) => entry.name).join("\n"));
  else if (command === "skills:read") console.log(readFileSync(findSkill(args[0]).path, "utf8"));
  else if (command === "skills:search") {
    const query = args.join(" ").trim().toLowerCase();
    if (!query) throw new Error("Usage: skills:search <query>");
    console.log(skillEntries().filter((entry) => readFileSync(entry.path, "utf8").toLowerCase().includes(query)).map((entry) => entry.name).join("\n"));
  } else if (command === "skills:route") route(args.join(" ").trim());
  else throw new Error("Usage: agent-contract.mjs check|skills:list|skills:read|skills:search|skills:route");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
