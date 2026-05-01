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

function getChangedFiles() {
  const explicitFiles = [...new Set(process.argv.slice(2).filter(Boolean))];
  if (explicitFiles.length > 0) {
    return explicitFiles;
  }

  const upstreamResult = spawnSync(
    'git',
    ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      env: process.env,
    },
  );

  const upstream = upstreamResult.status === 0 ? upstreamResult.stdout.trim() : '';
  if (!upstream) {
    return runGitDiff(['--name-only', '--diff-filter=ACMR', 'HEAD~1']);
  }

  return runGitDiff(['--name-only', '--diff-filter=ACMR', `${upstream}...HEAD`]);
}

function hasMatch(files, predicate) {
  return files.some(predicate);
}

const changedFiles = getChangedFiles();
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
const isTestFile = (file) =>
  /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) || file.startsWith('tests/') || file.startsWith('test/');

if (!changedFiles.some(isDocFile)) {
  run('pnpm', ['type-lint'], 'Type check failed during pre-push hook.');
  run('pnpm', ['build'], 'Build failed during pre-push hook.');
  run('pnpm', ['test'], 'Tests failed during pre-push hook.');
}

if (hasMatch(changedFiles, isTestFile)) {
  run('pnpm', ['test:package-bin'], 'Package-bin smoke test failed during pre-push hook.');
}

if (hasMatch(changedFiles, isCriticalFile)) {
  console.log('Critical files changed in this push; consider running `pnpm install` locally first.');
}
