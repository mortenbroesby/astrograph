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

function getStagedChanges() {
  const result = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
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

const stagedFiles = getStagedChanges();
if (stagedFiles.length === 0) {
  process.exit(0);
}

const hasSourceChanges = stagedFiles.some(
  (file) =>
    /\.(cjs|js|mjs|ts|tsx)$/.test(file) ||
    file.startsWith('src/') ||
    file.startsWith('bench/') ||
    file.startsWith('scripts/'),
);

if (hasSourceChanges) {
  run('pnpm', ['type-lint'], 'Type check failed. Commit blocked.');
}
