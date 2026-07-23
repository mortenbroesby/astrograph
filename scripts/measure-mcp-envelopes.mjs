import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { dispatchTool } from "../src/mcp.ts";
import { formatMcpEnvelope } from "../src/compact-mcp.ts";
import { clearStorageProcessCaches, indexFolder } from "../src/index.ts";
import { BENCHMARK_TOKENIZER, countTokens } from "../src/tokenizer.ts";

async function createFixtureRepo() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "astrograph-mcp-envelope-"));
  await mkdir(path.join(repoRoot, "src"), { recursive: true });
  await writeFile(
    path.join(repoRoot, "astrograph.config.json"),
    JSON.stringify({ storageLocation: "repo-local" }),
  );
  await writeFile(
    path.join(repoRoot, "src", "math.ts"),
    `import { formatLabel } from "./strings.js";

export const PI = 3.14;

/** Calculate the circle area label. */
export function area(radius: number): string {
  return formatLabel(PI * radius * radius);
}
`,
  );
  await writeFile(
    path.join(repoRoot, "src", "strings.ts"),
    `/** Format a label for display. */
export function formatLabel(value: number): string {
  return \`Area: \${value.toFixed(2)}\`;
}
`,
  );
  execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
  return repoRoot;
}

function stabilizeFixturePath(value, repoRoot) {
  if (typeof value === "string") {
    return value.replaceAll(repoRoot, "/fixture");
  }
  if (Array.isArray(value)) {
    return value.map((item) => stabilizeFixturePath(item, repoRoot));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, stabilizeFixturePath(item, repoRoot)]),
    );
  }
  return value;
}

async function capture(label, toolName, args, repoRoot) {
  const startedAt = performance.now();
  const envelope = await dispatchTool(toolName, args);
  const stableEnvelope = stabilizeFixturePath(envelope, repoRoot);
  const formattedJson = formatMcpEnvelope(toolName, "json", stableEnvelope);
  const formattedCompact = envelope.ok
    ? formatMcpEnvelope(toolName, "compact", stableEnvelope)
    : null;
  const hasCompact = formattedCompact?.metrics.selectedFormat === "compact";
  return {
    label,
    toolName,
    elapsedMs: Number((performance.now() - startedAt).toFixed(3)),
    bytes: Buffer.byteLength(formattedJson.serialized),
    tokens: countTokens(formattedJson.serialized),
    tokenizer: BENCHMARK_TOKENIZER,
    jsonEncoding: {
      encodeMs: formattedJson.metrics.encodeMs,
    },
    ok: envelope.ok,
    dataFreshness: envelope.meta.dataFreshness,
    compactDraft: hasCompact
      ? {
        bytes: formattedCompact.metrics.bytes,
        tokens: formattedCompact.metrics.tokens,
        savedBytes: formattedCompact.metrics.savedBytes,
        savedTokens: formattedCompact.metrics.savedTokens,
        savedPercent: formattedCompact.metrics.savedPercent,
        encodeMs: formattedCompact.metrics.encodeMs,
        referenceDecodeMs: formattedCompact.metrics.referenceDecodeMs,
        roundTrips: true,
      }
      : null,
    envelope: stableEnvelope,
  };
}

const repoRoot = await createFixtureRepo();
try {
  await indexFolder({ repoRoot });
  const captures = await Promise.all([
    capture("search-symbols-success", "search_symbols", { repoRoot, query: "area" }, repoRoot),
    capture("search-symbols-empty", "search_symbols", { repoRoot, query: "no-such-symbol" }, repoRoot),
    capture("search-symbols-error", "search_symbols", { repoRoot }, repoRoot),
    capture("file-tree", "get_file_tree", { repoRoot }, repoRoot),
    capture("file-outline", "get_file_outline", { repoRoot, filePath: "src/math.ts" }, repoRoot),
    capture("task-context", "get_task_context", {
      repoRoot,
      query: "How is the area label calculated?",
      payloadTokenBudget: 400,
    }, repoRoot),
  ]);
  process.stdout.write(`${JSON.stringify({
    generatedAt: new Date().toISOString(),
    fixture: "two-file TypeScript repository",
    captures,
  }, null, 2)}\n`);
} finally {
  clearStorageProcessCaches();
  await rm(repoRoot, { recursive: true, force: true });
}
