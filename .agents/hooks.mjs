#!/usr/bin/env node

import { createRequire } from 'node:module';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);

const SECRET_PATTERNS = [
  /\b(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*\S+/i,
  /\b(?:ghp_|gho_|ghs_|ghr_|github_pat_|glpat|xox[baprs]-|sk-[A-Za-z0-9]{20,})\b/i,
  /AKIA[0-9A-Z]{16}/,
  /BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY/i,
  /\b(?:mongodb|postgres|mysql|redis|amqp|smtp)(?:\+[a-z]+)?:\/\/[^:\s]+:[^@\s]+@/i,
];

const DESKTOP_NOTIFY_TITLE = 'Astrograph';

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit']);
const BLOCKED_DIRECTORY_PATTERNS = [
  { pattern: /(^|\/)\.git(\/|$)/i, reason: 'Editing inside .git is blocked.' },
  { pattern: /(^|\/)\.ssh(\/|$)/i, reason: 'Editing inside .ssh is blocked.' },
  { pattern: /(^|\/)(?:dist|build|\.next|\.turbo|coverage)(\/|$)/i, reason: 'Editing generated output directories is blocked.' },
];
const BLOCKED_BINARY_EXTENSIONS = new Set(['.a', '.avi', '.class', '.dll', '.dylib', '.exe', '.flac', '.mkv', '.mp4', '.o', '.pyc', '.zip']);

const DANGEROUS_PATTERNS = [
  /\bsudo\b/i,
  /\bcurl\b.*\|\s*(?:sh|bash|zsh|sudo)\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[a-zA-Z]*f\b/i,
  /\b(?:npm|yarn|pnpm|bun)\s+publish\b/i,
];

const blockedFileExtensions = new Set(['.a', '.avi', '.class', '.dll', '.dylib', '.exe', '.flac', '.mkv', '.mov', '.mp3', '.mp4', '.o', '.pyc', '.pyo', '.rar', '.so', '.tar', '.tgz', '.wasm', '.wav', '.zip']);
const PROTECTED_BASENAME_PATTERNS = [
  /^\.env(?:\.[^/]+)?$/i,
  /^\.npmrc$/i,
  /^\.pypirc$/i,
  /^pnpm-lock\.yaml$/i,
  /^package-lock\.json$/i,
  /^yarn\.lock$/i,
  /^.*\.(?:pem|key|crt|p12|pfx)$/i,
];

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === undefined || value === null) {
      continue;
    }
    const text = String(value).trim();
    if (text) {
      return text;
    }
  }
  return '';
}

function getEventName(payload, fallback = 'Notification') {
  return firstNonEmpty(payload?.hook_event_name, payload?.hookEventName, payload?.type, fallback);
}

function getToolName(payload) {
  return firstNonEmpty(payload?.tool_name, payload?.toolName, payload?.tool, '');
}

function getToolInput(payload) {
  return payload?.tool_input ?? payload?.toolInput ?? {};
}

function getPromptText(payload) {
  return firstNonEmpty(
    payload?.prompt,
    payload?.message,
    payload?.summary,
    payload?.['last-assistant-message'],
    payload?.last_assistant_message,
    payload?.raw,
    '',
  );
}

function isLikelySecret(text) {
  return SECRET_PATTERNS.some((pattern) => pattern.test(String(text ?? '')));
}

function getProjectRoot(payload) {
  return path.resolve(
    firstNonEmpty(
      payload?.context?.projectDir,
      payload?.context?.project_dir,
      payload?.cwd,
      process.env.CLAUDE_PROJECT_DIR,
      process.env.CODEX_WORKSPACE,
      process.cwd(),
    ),
  );
}

function normalizeToolPath(filePath) {
  return String(filePath ?? '').replaceAll(path.sep, '/');
}

function getTouchedPaths(payload) {
  const toolInput = getToolInput(payload);
  const candidates = [
    toolInput?.file_path,
    toolInput?.path,
    toolInput?.file,
    payload?.file_path,
    payload?.path,
    ...(Array.isArray(toolInput?.file_paths) ? toolInput.file_paths : []),
    ...(Array.isArray(toolInput?.paths) ? toolInput.paths : []),
  ];
  return candidates.map((value) => firstNonEmpty(value, '')).filter(Boolean);
}

function getWriteContentFragments(payload) {
  const toolName = getToolName(payload);
  const toolInput = getToolInput(payload);
  if (toolName === 'Write') {
    return Array.isArray(toolInput?.content) ? toolInput.content : [toolInput?.content].filter(Boolean);
  }
  if (toolName === 'Edit') {
    return Array.isArray(toolInput?.new_string) ? toolInput.new_string : [toolInput?.new_string].filter(Boolean);
  }
  if (toolName === 'MultiEdit') {
    return Array.isArray(toolInput?.edits)
      ? toolInput.edits.map((edit) => edit?.new_string).filter(Boolean)
      : [];
  }
  return [];
}

function readAgentSettings(projectRoot) {
  const settingsPath = path.join(projectRoot, '.agents', 'settings.cjs');
  try {
    delete require.cache[settingsPath];
    const settings = require(settingsPath);
    return settings && typeof settings === 'object' ? settings : {};
  } catch {
    return {};
  }
}

function isPathInsideProject(projectRoot, filePath) {
  const resolvedPath = path.resolve(projectRoot, filePath);
  const rel = path.relative(projectRoot, resolvedPath);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function loadProfile(projectRoot) {
  const gitDir = (() => {
    const out = spawnSync('git', ['rev-parse', '--git-dir'], { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.status === 0 ? out.stdout.trim() : '';
  })();
  const branch = (() => {
    const out = spawnSync('git', ['branch', '--show-current'], { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.status === 0 ? out.stdout.trim() : '';
  })();
  const porcelain = (() => {
    const out = spawnSync('git', ['status', '--porcelain'], { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.status === 0 ? out.stdout.trim() : '';
  })();
  const changeCount = porcelain ? porcelain.split(/\r?\n/).filter(Boolean).length : 0;
  const parts = [];
  if (branch) {
    parts.push(`branch: ${branch}`);
  } else if (gitDir) {
    const sha = (() => {
      const out = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return out.status === 0 ? out.stdout.trim() : '';
    })();
    if (sha) {
      parts.push(`HEAD ${sha}`);
    }
  }
  if (changeCount > 0) {
    parts.push(`uncommitted: ${changeCount}`);
  }
  return parts.join(' | ');
}

function buildJson(data) {
  return `${JSON.stringify(data)}\n`;
}

function preToolDeny(reason) {
  return {
    stdout: buildJson({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  };
}

function userPromptBlock(reason) {
  return { stdout: buildJson({ decision: 'block', reason }) };
}

function blockMessageForFile(filePath) {
  const normalizedPath = normalizeToolPath(filePath);
  const basename = path.basename(normalizedPath);

  for (const rule of BLOCKED_DIRECTORY_PATTERNS) {
    if (rule.pattern.test(normalizedPath)) {
      return rule.reason;
    }
  }
  const extension = path.extname(normalizedPath).toLowerCase();
  if (blockedFileExtensions.has(extension)) {
    return `Writing ${extension} artifacts is blocked. Add manually if needed.`;
  }
  if (PROTECTED_BASENAME_PATTERNS.some((pattern) => pattern.test(basename))) {
    return `Editing protected file ${basename} is blocked.`;
  }
  return '';
}

function readPayloadFromStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    process.stdin.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({ raw, type: 'notify' });
      }
    });
  });
}

async function runHook(hookName, handler) {
  const payload = await readPayloadFromStdin();
  if (!payload) {
    return;
  }

  const result = await handler(payload);
  if (result?.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result?.stderr) {
    process.stderr.write(result.stderr);
  }
  if (typeof result?.exitCode === 'number') {
    process.exit(result.exitCode);
  }
}

function runSessionStart(payload) {
  const projectRoot = getProjectRoot(payload);
  const profile = loadProfile(projectRoot);
  const missing = [];
  if (!existsSync(path.join(projectRoot, 'node_modules'))) {
    missing.push('node_modules/');
  }
  if (!existsSync(path.join(projectRoot, 'node_modules', '.bin', 'astrograph'))) {
    missing.push('node_modules/.bin/astrograph');
  }

  const context = [
    'Shared repo hook policy is active.',
    'Use repo-first exploration and keep edits targeted.',
  ];
  if (profile) context.push(`Git: ${profile}`);
  if (missing.length > 0) context.push(`Run pnpm install before using repo-local tooling. Missing: ${missing.join(', ')}`);

  return { stdout: buildJson({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context.join('\n') } }) };
}

function findDangerousCommand(command, projectRoot) {
  if (!command) return '';
  if (/\brm\s+-[a-zA-Z]*r.*\s+(?:\/\s|\/\*|\/$|~\/?\*?(?:\s|$))/i.test(command)) {
    return 'Recursive delete targeting root/home-like paths is blocked.';
  }
  if (/\bgit\s+push\b/i.test(command)) {
    if (/\bgit\s+push\b.*(?:main|master)\b/i.test(command)) {
      const settings = readAgentSettings(projectRoot);
      if (settings.allowDirectMainPush !== true && !/CODEX_ALLOW_DIRECT_MAIN_PUSH=1/.test(command)) {
        return 'Direct push to main/master is blocked. Use a branch and PR flow.';
      }
    }
    if (/\bgit\s+push\s*(?:$|[;&|])/i.test(command)) {
      const branch = (() => {
        const out = spawnSync('git', ['branch', '--show-current'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        return out.status === 0 ? out.stdout.trim() : '';
      })();
      if (['main', 'master'].includes(branch) && !/CODEX_ALLOW_DIRECT_MAIN_PUSH=1/.test(command)) {
        return `Push blocked on ${branch}. Use feature branch + PR.`;
      }
    }
  }

  for (const item of DANGEROUS_PATTERNS) {
    if (item.pattern?.test?.(command)) {
      return item.reason || 'Blocked command.';
    }
  }
  return '';
}

function handlePromptSecrets(payload) {
  return isLikelySecret(getPromptText(payload)) ? userPromptBlock('Prompt appears to contain credentials. Please remove secrets before continuing.') : {};
}

function handleDangerous(payload) {
  const command = firstNonEmpty(getToolInput(payload)?.command, '');
  const reason = findDangerousCommand(command, getProjectRoot(payload));
  return reason ? preToolDeny(reason) : {};
}

function handleProtect(payload) {
  for (const filePath of getTouchedPaths(payload)) {
    const cwd = getProjectRoot(payload);
    if (!isPathInsideProject(cwd, filePath)) return preToolDeny('Editing outside project root is blocked.');
    const reason = blockMessageForFile(filePath);
    if (reason) return preToolDeny(reason);
  }
  return {};
}

function handleWarnLargeFiles(payload) {
  for (const filePath of getTouchedPaths(payload)) {
    const normalized = normalizeToolPath(filePath);
    if (BLOCKED_DIRECTORY_PATTERNS.some((rule) => rule.pattern.test(normalized))) {
      return preToolDeny(blockMessageForFile(filePath));
    }
    const extension = path.extname(normalized).toLowerCase();
    if (BLOCKED_BINARY_EXTENSIONS.has(extension)) {
      return preToolDeny(`Writing ${extension} artifacts is blocked.`);
    }
  }
  return {};
}

function handleScanSecrets(payload) {
  const fragments = getWriteContentFragments(payload);
  if (!fragments.length) return {};
  return fragments.some((fragment) => isLikelySecret(fragment))
    ? preToolDeny('Possible secret detected in edited content. Use .env files or secrets vault.')
    : {};
}

function handleCodeNav(payload) {
  const toolName = getToolName(payload);
  const toolInput = getToolInput(payload);
  if (toolName !== 'Bash') return {};
  const command = firstNonEmpty(toolInput?.command, '');
  if (!command) return {};
  if (
    /\brg\b/.test(command) ||
    /\bgrep\b/.test(command) ||
    /\bcat\b/.test(command) ||
    /\bls\b/.test(command)
  ) {
    return {};
  }
  if (/\b(?:cat|sed|awk|node|npm|pnpm|git|astrograph)\b/.test(command)) {
    return {};
  }
  return { stderr: 'For exploratory reads, prefer targeted reads and repo search tools first. Use broader reads in small chunks.\n' };
}

function handleAudit(payload) {
  const protectedPaths = getTouchedPaths(payload).filter((filePath) => !!blockMessageForFile(filePath));
  if (!protectedPaths.length) return {};
  return {
    stdout: buildJson({
      decision: 'block',
      reason: 'A protected file was modified.',
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `Protected path touched: ${protectedPaths.join(', ')}`,
      },
    }),
  };
}

function maybeNotify(payload) {
  if (process.platform !== 'darwin') return {};
  const cwd = getProjectRoot(payload);
  const body = getPromptText(payload) || 'Agent turn complete';
  const script = `display notification ${JSON.stringify(body.slice(0, 140))} with title ${JSON.stringify(DESKTOP_NOTIFY_TITLE)} subtitle ${JSON.stringify(path.basename(cwd) || 'session')}`;
  const child = spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' });
  child.unref();
  return {};
}

async function handle(payload) {
  const eventName = getEventName(payload);
  const toolName = getToolName(payload);

  if (eventName === 'SessionStart') return runSessionStart(payload);
  if (eventName === 'UserPromptSubmit') return handlePromptSecrets(payload);
  if (eventName === 'PreToolUse' && toolName === 'Bash') return handleDangerous(payload);
  if (eventName === 'PreToolUse' && EDIT_TOOLS.has(toolName)) {
    const handlers = [handleProtect, handleWarnLargeFiles, handleScanSecrets];
    for (const fn of handlers) {
      const result = fn(payload);
      if (result.stdout || result.stderr || typeof result.exitCode === 'number') return result;
    }
  }
  if (eventName === 'PostToolUse' && EDIT_TOOLS.has(toolName)) return handleAudit(payload);
  if (eventName === 'Notification' || eventName === 'notify' || eventName === 'notify-error') return maybeNotify(payload);
  if (eventName === 'CodeNav' || eventName === 'Read') return handleCodeNav(payload);

  return {};
}

async function main() {
  await runHook('agent-hooks-compat', handle);
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    process.stderr.write(String(error && error.stack ? error.stack : error));
    process.exitCode = 1;
  });
}
