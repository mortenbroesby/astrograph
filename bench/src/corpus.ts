import { readFileSync } from "node:fs";
import path from "node:path";

import type {
  BenchmarkCorpus,
  BenchmarkCorpusManifest,
  BenchmarkCorpusManifestTask,
  BenchmarkCorpusTask,
  BenchmarkTarget,
  BenchmarkTaskCard,
  BenchmarkTaskCardFrontmatter,
} from "./types.ts";

function parseJsonObject(text: string, filePath: string): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse JSON corpus manifest at ${filePath}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Corpus manifest at ${filePath} must be a JSON object`);
  }

  return parsed as Record<string, unknown>;
}

function assertString(value: unknown, field: string, filePath: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Field "${field}" in ${filePath} must be a non-empty string`);
  }

  return value;
}

function assertStringArray(
  value: unknown,
  field: string,
  filePath: string,
): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`Field "${field}" in ${filePath} must be an array of strings`);
  }

  return value;
}

function assertTargetArray(
  value: unknown,
  field: string,
  filePath: string,
): readonly BenchmarkTarget[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "object" || entry === null)
  ) {
    throw new Error(`Field "${field}" in ${filePath} must be an array of targets`);
  }

  return value.map((entry, index) => {
    const target = entry as Record<string, unknown>;
    return {
      kind: assertString(target.kind, `${field}[${index}].kind`, filePath) as "symbol",
      value: assertString(target.value, `${field}[${index}].value`, filePath),
      mode: assertString(target.mode, `${field}[${index}].mode`, filePath) as "exact",
    };
  });
}

function assertManifestTask(
  value: unknown,
  index: number,
  filePath: string,
): BenchmarkCorpusManifestTask {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Task ${index} in ${filePath} must be an object`);
  }

  const task = value as Record<string, unknown>;
  return {
    id: assertString(task.id, `tasks[${index}].id`, filePath),
    path: assertString(task.path, `tasks[${index}].path`, filePath),
    slice: assertString(task.slice, `tasks[${index}].slice`, filePath),
    workflows: assertStringArray(task.workflows, `tasks[${index}].workflows`, filePath),
    allowedPaths: assertStringArray(
      task.allowedPaths,
      `tasks[${index}].allowedPaths`,
      filePath,
    ),
    targets: assertTargetArray(task.targets, `tasks[${index}].targets`, filePath),
  };
}

export function loadBenchmarkCorpusManifest(
  manifestPath: string,
): BenchmarkCorpusManifest {
  const json = parseJsonObject(readFileSync(manifestPath, "utf8"), manifestPath);

  const schemaVersion = json.schemaVersion;
  if (schemaVersion !== 1) {
    throw new Error(`Corpus manifest at ${manifestPath} must declare schemaVersion 1`);
  }

  const tasksValue = json.tasks;
  if (!Array.isArray(tasksValue)) {
    throw new Error(`Corpus manifest at ${manifestPath} must contain a tasks array`);
  }

  return {
    schemaVersion: 1,
    benchmark: assertString(json.benchmark, "benchmark", manifestPath),
    repo: assertString(json.repo, "repo", manifestPath),
    repoSha: assertString(json.repoSha, "repoSha", manifestPath),
    tokenizer: assertString(json.tokenizer, "tokenizer", manifestPath),
    tasks: tasksValue.map((task, index) => assertManifestTask(task, index, manifestPath)),
  };
}

function parseScalar(value: string): string | number | boolean | null {
  const trimmed = value.trim();
  if (trimmed === "null") {
    return null;
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  const quoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));
  return quoted ? trimmed.slice(1, -1) : trimmed;
}

function parseFlowArray(value: string): readonly string[] {
  const inner = value.slice(1, -1).trim();
  if (inner.length === 0) {
    return [];
  }

  return inner.split(",").map((entry) => String(parseScalar(entry)).trim());
}

function normalizeKeyValue(line: string): [string, string] {
  const colonIndex = line.indexOf(":");
  if (colonIndex < 0) {
    throw new Error(`Invalid frontmatter line: ${line}`);
  }

  const key = line.slice(0, colonIndex).trim();
  const value = line.slice(colonIndex + 1).trim();
  return [key, value];
}

function countIndent(line: string): number {
  let indent = 0;
  while (indent < line.length && line[indent] === " ") {
    indent += 1;
  }
  return indent;
}

function parseSequenceValue(lines: string[], startIndex: number, indent: number): [unknown[], number] {
  const values: unknown[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const currentIndent = countIndent(line);
    if (currentIndent < indent) {
      break;
    }

    const trimmed = line.slice(indent);
    if (!trimmed.startsWith("- ")) {
      break;
    }

    const itemText = trimmed.slice(2);
    if (itemText.includes(":")) {
      const [firstKey, firstValue] = normalizeKeyValue(itemText);
      const item: Record<string, string> = {
        [firstKey]: firstValue,
      };
      index += 1;

      while (index < lines.length) {
        const nextLine = lines[index];
        if (!nextLine.trim()) {
          index += 1;
          continue;
        }
        const nextIndent = countIndent(nextLine);
        if (nextIndent <= indent) {
          break;
        }
        const [key, value] = normalizeKeyValue(nextLine.trim());
        item[key] = value;
        index += 1;
      }

      values.push(item);
      continue;
    }

    values.push(parseScalar(itemText));
    index += 1;
  }

  return [values, index];
}

function parseFrontmatter(text: string, filePath: string): BenchmarkTaskCardFrontmatter {
  const lines = text.split(/\r?\n/);
  const frontmatter: Record<string, unknown> = {};
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const [key, value] = normalizeKeyValue(line.trim());
    if (value.length > 0) {
      frontmatter[key] =
        value.startsWith("[") && value.endsWith("]")
          ? parseFlowArray(value)
          : parseScalar(value);
      index += 1;
      continue;
    }

    index += 1;
    while (index < lines.length && !lines[index].trim()) {
      index += 1;
    }

    if (index >= lines.length) {
      frontmatter[key] = [];
      break;
    }

    const nextLine = lines[index];
    const nextIndent = countIndent(nextLine);
    if (nextLine.trim().startsWith("- ")) {
      const [sequence, nextIndex] = parseSequenceValue(lines, index, nextIndent);
      frontmatter[key] = sequence;
      index = nextIndex;
      continue;
    }

    const nested: Record<string, unknown> = {};
    while (index < lines.length) {
      const currentLine = lines[index];
      if (!currentLine.trim()) {
        index += 1;
        continue;
      }

      const currentIndent = countIndent(currentLine);
      if (currentIndent < nextIndent) {
        break;
      }

      const [nestedKey, nestedValue] = normalizeKeyValue(currentLine.trim());
      nested[nestedKey] =
        nestedValue.length > 0
          ? nestedValue.startsWith("[") && nestedValue.endsWith("]")
            ? parseFlowArray(nestedValue)
            : parseScalar(nestedValue)
          : null;
      index += 1;
    }

    frontmatter[key] = nested;
  }

  return {
    id: assertString(frontmatter.id, "id", filePath),
    slice: assertString(frontmatter.slice, "slice", filePath),
    query: assertString(frontmatter.query, "query", filePath),
    workflowSet: assertStringArray(frontmatter.workflowSet, "workflowSet", filePath),
    allowedPaths: assertStringArray(frontmatter.allowedPaths, "allowedPaths", filePath),
    targets: assertTargetArray(frontmatter.targets, "targets", filePath),
    successCriteria: assertStringArray(
      frontmatter.successCriteria,
      "successCriteria",
      filePath,
    ),
    alternateTargets: Array.isArray(frontmatter.alternateTargets)
      ? assertTargetArray(frontmatter.alternateTargets, "alternateTargets", filePath)
      : undefined,
    notes:
      typeof frontmatter.notes === "string"
        ? frontmatter.notes
        : undefined,
    excludedPaths: Array.isArray(frontmatter.excludedPaths)
      ? assertStringArray(frontmatter.excludedPaths, "excludedPaths", filePath)
      : undefined,
    expectedArtifacts: Array.isArray(frontmatter.expectedArtifacts)
      ? assertStringArray(frontmatter.expectedArtifacts, "expectedArtifacts", filePath)
      : undefined,
  };
}

function splitTaskCard(markdown: string, filePath: string): { frontmatter: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(markdown);
  if (!match) {
    throw new Error(`Task card at ${filePath} must start with YAML frontmatter`);
  }

  return {
    frontmatter: match[1],
    body: match[2] ?? "",
  };
}

export function loadBenchmarkTaskCard(taskPath: string): BenchmarkTaskCard {
  const markdown = readFileSync(taskPath, "utf8");
  const { frontmatter, body } = splitTaskCard(markdown, taskPath);

  return {
    path: taskPath,
    frontmatter: parseFrontmatter(frontmatter, taskPath),
    body,
  };
}

function compareSequence(
  manifestField: string,
  expected: readonly string[],
  actual: readonly string[],
  taskId: string,
): void {
  const equal =
    expected.length === actual.length &&
    expected.every((value, index) => value === actual[index]);
  if (!equal) {
    throw new Error(
      `Task "${taskId}" mismatches manifest field "${manifestField}"`,
    );
  }
}

function compareTargets(
  expected: readonly BenchmarkTarget[],
  actual: readonly BenchmarkTarget[],
  taskId: string,
): void {
  const equal =
    expected.length === actual.length &&
    expected.every(
      (target, index) =>
        target.kind === actual[index]?.kind &&
        target.value === actual[index]?.value &&
        target.mode === actual[index]?.mode,
    );
  if (!equal) {
    throw new Error(`Task "${taskId}" mismatches manifest targets`);
  }
}

function validateTaskAgainstManifest(
  manifestTask: BenchmarkCorpusManifestTask,
  taskCard: BenchmarkTaskCard,
): BenchmarkCorpusTask {
  const taskId = manifestTask.id;

  if (taskCard.frontmatter.id !== manifestTask.id) {
    throw new Error(
      `Task "${taskId}" mismatches manifest field "id"`,
    );
  }
  if (taskCard.frontmatter.slice !== manifestTask.slice) {
    throw new Error(
      `Task "${taskId}" mismatches manifest field "slice"`,
    );
  }
  compareSequence("workflowSet", manifestTask.workflows, taskCard.frontmatter.workflowSet, taskId);
  compareSequence(
    "allowedPaths",
    manifestTask.allowedPaths,
    taskCard.frontmatter.allowedPaths,
    taskId,
  );
  compareTargets(manifestTask.targets, taskCard.frontmatter.targets, taskId);

  return {
    ...taskCard,
    manifest: manifestTask,
  };
}

export function loadBenchmarkCorpus(manifestPath: string): BenchmarkCorpus {
  const manifest = loadBenchmarkCorpusManifest(manifestPath);
  const manifestDir = path.dirname(manifestPath);

  return {
    manifestPath,
    manifest,
    tasks: manifest.tasks.map((manifestTask) => {
      const taskPath = path.resolve(manifestDir, manifestTask.path);
      const relativeTaskPath = path.relative(manifestDir, taskPath);
      if (
        relativeTaskPath === ".." ||
        relativeTaskPath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeTaskPath)
      ) {
        throw new Error(`Task "${manifestTask.id}" path escapes the corpus root`);
      }
      const taskCard = loadBenchmarkTaskCard(taskPath);
      return validateTaskAgainstManifest(manifestTask, taskCard);
    }),
  };
}
