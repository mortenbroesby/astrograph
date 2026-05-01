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

function getMergedFiles(oldRef, newRef) {
  const result = spawnSync('git', ['diff', '--name-only', oldRef, newRef, '--', 'package.json', 'pnpm-lock.yaml'], {
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

const [oldRef, newRef] = process.argv.slice(2);
const mergedFiles = oldRef && newRef ? getMergedFiles(oldRef, newRef) : [];

if (mergedFiles.length === 0) {
  process.exit(0);
}

run('pnpm', ['install'], 'pnpm install failed after merge.');
