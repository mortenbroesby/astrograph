import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadRepoEngineConfig, resolveEnginePaths } from "./config.ts";
import { getSymbolSource } from "./storage.ts";

export interface Bookmark {
  id: string;
  createdAt: string;
  intent: string;
  symbolId: string;
  note: string | null;
}

function bookmarksPath(storageDir: string): string {
  return path.join(storageDir, "bookmarks.json");
}

async function readBookmarks(storageDir: string): Promise<Bookmark[]> {
  const contents = await readFile(bookmarksPath(storageDir), "utf8").catch(() => "[]");
  try {
    const value: unknown = JSON.parse(contents);
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is Bookmark => Boolean(entry)
      && typeof entry === "object"
      && typeof (entry as Bookmark).id === "string"
      && typeof (entry as Bookmark).createdAt === "string"
      && typeof (entry as Bookmark).intent === "string"
      && typeof (entry as Bookmark).symbolId === "string"
      && ((entry as Bookmark).note === null || typeof (entry as Bookmark).note === "string"));
  } catch {
    return [];
  }
}

async function writeBookmarks(storageDir: string, bookmarks: Bookmark[]): Promise<void> {
  await mkdir(storageDir, { recursive: true });
  await writeFile(bookmarksPath(storageDir), `${JSON.stringify(bookmarks, null, 2)}\n`, "utf8");
}

async function storageDirFor(repoRoot: string): Promise<string> {
  const config = await loadRepoEngineConfig(repoRoot);
  return resolveEnginePaths(config.repoRoot, { storageLocation: config.storageLocation }).storageDir;
}

export async function createBookmark(input: { repoRoot: string; symbolId: string; intent: string; note?: string }): Promise<Bookmark> {
  const storageDir = await storageDirFor(input.repoRoot);
  const bookmark: Bookmark = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    intent: input.intent,
    symbolId: input.symbolId,
    note: input.note ?? null,
  };
  const bookmarks = await readBookmarks(storageDir);
  bookmarks.push(bookmark);
  await writeBookmarks(storageDir, bookmarks);
  return bookmark;
}

export async function listBookmarks(repoRoot: string): Promise<Bookmark[]> {
  return readBookmarks(await storageDirFor(repoRoot));
}

export async function deleteBookmark(input: { repoRoot: string; id: string }): Promise<{ deleted: boolean }> {
  const storageDir = await storageDirFor(input.repoRoot);
  const bookmarks = await readBookmarks(storageDir);
  const next = bookmarks.filter((bookmark) => bookmark.id !== input.id);
  if (next.length !== bookmarks.length) await writeBookmarks(storageDir, next);
  return { deleted: next.length !== bookmarks.length };
}

export async function resolveBookmark(input: { repoRoot: string; id: string }): Promise<{ status: "available" | "missing"; bookmark: Bookmark | null }> {
  const bookmark = (await listBookmarks(input.repoRoot)).find((entry) => entry.id === input.id) ?? null;
  if (!bookmark) return { status: "missing", bookmark: null };
  try {
    const source = await getSymbolSource({ repoRoot: input.repoRoot, symbolId: bookmark.symbolId });
    return { status: source.items.length > 0 ? "available" : "missing", bookmark };
  } catch {
    return { status: "missing", bookmark };
  }
}
