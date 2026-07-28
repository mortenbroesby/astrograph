#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function run(command, args, errorMessage) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    console.error(errorMessage ?? `Command failed: ${command} ${args.join(' ')}`);
    process.exit(result.status);
  }
}

function runGitDiff(args) {
  const result = spawnSync('git', ['diff', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: process.env,
  });

  if (result.error || result.status !== 0) {
    return [];
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function getComparisonRef() {
  const upstreamResult = spawnSync(
    'git',
    ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      env: process.env,
    },
  );
  return upstreamResult.status === 0 ? upstreamResult.stdout.trim() : 'HEAD~1';
}

function getChangedFiles(comparisonRef) {
  const explicitFiles = [...new Set(process.argv.slice(2).filter(Boolean))];
  if (explicitFiles.length > 0) {
    return explicitFiles;
  }

  return runGitDiff(['--name-only', '--diff-filter=ACMR', `${comparisonRef}...HEAD`]);
}

function hasMatch(files, predicate) {
  return files.some(predicate);
}

const comparisonRef = getComparisonRef();
const changedFiles = getChangedFiles(comparisonRef);
if (changedFiles.length === 0) {
  process.exit(0);
}

const isDocFile = (file) => /\.(?:md|mdx)$/i.test(file);
const isSourceFile = (file) =>
  /\.(cjs|js|mjs|ts|tsx)$/.test(file) ||
  file.startsWith('src/') ||
  file.startsWith('bench/') ||
  file.startsWith('scripts/');
const isCriticalFile = (file) =>
  ['package.json', 'pnpm-lock.yaml'].includes(file) ||
  file.startsWith('.github/workflows/') ||
  file.startsWith('.husky/');

run('git', ['fetch', '--quiet', 'origin', 'main'], 'Could not refresh origin/main before checking the required version bump.');
run('pnpm', ['check:version-bump', '--base', 'origin/main'], 'Version bump is required before pushing versioned changes.');
run('pnpm', ['agents:check'], 'Agent contract check failed; update tracked agent configuration before pushing.');

if (!changedFiles.some(isDocFile)) {
  run('pnpm', ['type-lint'], 'Type check failed during pre-push hook.');
  run('pnpm', ['build'], 'Build failed during pre-push hook.');
}

if (hasMatch(changedFiles, isCriticalFile)) {
  console.log('Critical files changed in this push; consider running `pnpm install` locally first.');
}
