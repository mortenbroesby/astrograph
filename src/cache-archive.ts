import { lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export interface CacheArchiveReceipt {
  schemaVersion: 1;
  originalPath: string;
  archivePath: string;
  reason: string;
  archivedAt: string;
}

export async function restoreManagedDirectory(input: {
  receiptPath: string;
  archiveRoot: string;
  originalRoot: string;
}): Promise<CacheArchiveReceipt> {
  const archiveRoot = path.resolve(input.archiveRoot);
  const originalRoot = path.resolve(input.originalRoot);
  const receiptPath = path.resolve(input.receiptPath);
  const receiptRelative = path.relative(archiveRoot, receiptPath);
  if (receiptRelative.startsWith("..") || path.isAbsolute(receiptRelative)) throw new Error("Receipt must be inside the managed archive root.");
  const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as CacheArchiveReceipt;
  const archivePath = path.resolve(receipt.archivePath);
  const originalPath = path.resolve(receipt.originalPath);
  for (const [root, target, label] of [[archiveRoot, archivePath, "archive"], [originalRoot, originalPath, "restore target"]] as const) {
    const relative = path.relative(root, target);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || relative.includes(path.sep)) throw new Error(`Receipt has an invalid ${label} path.`);
  }
  const archived = await lstat(archivePath).catch(() => null);
  if (!archived?.isDirectory() || archived.isSymbolicLink()) throw new Error("Archived cache directory is missing or unsafe.");
  if (await lstat(originalPath).catch(() => null)) throw new Error("Refusing to restore over an existing cache directory.");
  await rename(archivePath, originalPath);
  return receipt;
}

export async function archiveManagedDirectory(input: {
  target: string;
  archiveRoot: string;
  reason: string;
}): Promise<CacheArchiveReceipt> {
  const target = path.resolve(input.target);
  const archiveRoot = path.resolve(input.archiveRoot);
  const targetEntry = await lstat(target).catch(() => null);
  if (!targetEntry) throw new Error(`Cannot archive missing cache path: ${target}`);
  if (!targetEntry.isDirectory() || targetEntry.isSymbolicLink()) {
    throw new Error(`Refusing to archive a non-directory or symlinked cache path: ${target}`);
  }
  const relative = path.relative(path.dirname(target), archiveRoot);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Archive root must be adjacent to the managed cache path: ${archiveRoot}`);
  }
  await mkdir(archiveRoot, { recursive: true, mode: 0o700 });
  if ((await lstat(archiveRoot)).isSymbolicLink()) throw new Error(`Refusing symlinked archive root: ${archiveRoot}`);
  const archivedAt = new Date().toISOString();
  const archivePath = path.join(archiveRoot, `${archivedAt.replace(/[:.]/g, "-")}-${path.basename(target)}`);
  if (await lstat(archivePath).catch(() => null)) throw new Error(`Refusing archive collision: ${archivePath}`);
  await rename(target, archivePath);
  const receipt: CacheArchiveReceipt = { schemaVersion: 1, originalPath: target, archivePath, reason: input.reason, archivedAt };
  await writeFile(`${archivePath}.receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  return receipt;
}
