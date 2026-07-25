import { lstat, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export interface CacheArchiveReceipt {
  schemaVersion: 1;
  originalPath: string;
  archivePath: string;
  reason: string;
  archivedAt: string;
  bytes: number;
  recoveryCommand: string;
}

function assertDirectChild(root: string, target: string, label: string): void {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || relative.includes(path.sep)) {
    throw new Error(`Receipt has an invalid ${label} path.`);
  }
}

function parseReceipt(value: unknown): CacheArchiveReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Receipt must be a JSON object.");
  }
  const receipt = value as Record<string, unknown>;
  if (
    receipt.schemaVersion !== 1
    || typeof receipt.originalPath !== "string"
    || typeof receipt.archivePath !== "string"
    || typeof receipt.reason !== "string" || !receipt.reason
    || typeof receipt.archivedAt !== "string" || Number.isNaN(Date.parse(receipt.archivedAt))
    || typeof receipt.bytes !== "number" || !Number.isSafeInteger(receipt.bytes) || receipt.bytes < 0
    || typeof receipt.recoveryCommand !== "string" || !receipt.recoveryCommand
  ) {
    throw new Error("Receipt has an invalid schema.");
  }
  return receipt as unknown as CacheArchiveReceipt;
}

async function directoryBytes(target: string): Promise<number> {
  const entry = await lstat(target);
  if (entry.isSymbolicLink()) throw new Error(`Refusing symlinked cache path: ${target}`);
  if (entry.isFile()) return entry.size;
  if (!entry.isDirectory()) return 0;
  let bytes = 0;
  for (const child of await readdir(target)) bytes += await directoryBytes(path.join(target, child));
  return bytes;
}

export async function readManagedArchiveReceipt(input: {
  receiptPath: string;
  archiveRoot: string;
  originalRoot: string;
}): Promise<CacheArchiveReceipt> {
  const archiveRoot = path.resolve(input.archiveRoot);
  const originalRoot = path.resolve(input.originalRoot);
  const receiptPath = path.resolve(input.receiptPath);
  assertDirectChild(archiveRoot, receiptPath, "receipt");
  const receipt = parseReceipt(JSON.parse(await readFile(receiptPath, "utf8")));
  const archivePath = path.resolve(receipt.archivePath);
  const originalPath = path.resolve(receipt.originalPath);
  assertDirectChild(archiveRoot, archivePath, "archive");
  assertDirectChild(originalRoot, originalPath, "restore target");
  return receipt;
}

export async function restoreManagedDirectory(input: {
  receiptPath: string;
  archiveRoot: string;
  originalRoot: string;
}): Promise<CacheArchiveReceipt> {
  const receipt = await validateManagedArchiveRestore(input);
  await rename(path.resolve(receipt.archivePath), path.resolve(receipt.originalPath));
  return receipt;
}

export async function validateManagedArchiveRestore(input: {
  receiptPath: string;
  archiveRoot: string;
  originalRoot: string;
}): Promise<CacheArchiveReceipt> {
  const receipt = await readManagedArchiveReceipt(input);
  const archivePath = path.resolve(receipt.archivePath);
  const originalPath = path.resolve(receipt.originalPath);
  const archived = await lstat(archivePath).catch(() => null);
  if (!archived?.isDirectory() || archived.isSymbolicLink()) throw new Error("Archived cache directory is missing or unsafe.");
  if (await lstat(originalPath).catch(() => null)) throw new Error("Refusing to restore over an existing cache directory.");
  return receipt;
}

export async function archiveManagedDirectory(input: {
  target: string;
  archiveRoot: string;
  reason: string;
  recoveryCommand: (receiptPath: string) => string;
  now?: () => Date;
  move?: (from: string, to: string) => Promise<void>;
}): Promise<CacheArchiveReceipt> {
  const target = path.resolve(input.target);
  const archiveRoot = path.resolve(input.archiveRoot);
  const parent = path.dirname(target);
  assertDirectChild(parent, archiveRoot, "archive root");
  const targetEntry = await lstat(target).catch(() => null);
  if (!targetEntry) throw new Error(`Cannot archive missing cache path: ${target}`);
  if (!targetEntry.isDirectory() || targetEntry.isSymbolicLink()) {
    throw new Error(`Refusing to archive a non-directory or symlinked cache path: ${target}`);
  }
  await mkdir(archiveRoot, { recursive: true, mode: 0o700 });
  const archiveRootEntry = await lstat(archiveRoot);
  if (!archiveRootEntry.isDirectory() || archiveRootEntry.isSymbolicLink()) throw new Error(`Refusing symlinked archive root: ${archiveRoot}`);
  const archivedAt = (input.now ?? (() => new Date()))().toISOString();
  const archivePath = path.join(archiveRoot, `${archivedAt.replace(/[:.]/g, "-")}-${path.basename(target)}`);
  const receiptPath = `${archivePath}.receipt.json`;
  if (await lstat(archivePath).catch(() => null) || await lstat(receiptPath).catch(() => null)) {
    throw new Error(`Refusing archive collision: ${archivePath}`);
  }
  const bytes = await directoryBytes(target);
  const receipt: CacheArchiveReceipt = {
    schemaVersion: 1,
    originalPath: target,
    archivePath,
    reason: input.reason,
    archivedAt,
    bytes,
    recoveryCommand: input.recoveryCommand(receiptPath),
  };
  // Write the auditable receipt before moving data. If the move fails, the
  // original remains in place and the receipt identifies the failed attempt.
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  await (input.move ?? rename)(target, archivePath);
  return receipt;
}
