import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { archiveManagedDirectory } from "../src/cache-archive.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((target) => rm(target, { recursive: true, force: true })));
});

async function createManagedCache() {
  const root = await mkdtemp(path.join(os.tmpdir(), "astrograph-cache-archive-"));
  tempDirs.push(root);
  const target = path.join(root, ".astrograph");
  const archiveRoot = path.join(root, ".astrograph-archive");
  await mkdir(target);
  await writeFile(path.join(target, "payload.txt"), "preserve these bytes");
  return { root, target, archiveRoot };
}

describe("managed cache archive", () => {
  it("refuses a deterministic archive collision without touching the cache", async () => {
    const { target, archiveRoot } = await createManagedCache();
    const now = () => new Date("2026-07-22T00:00:00.000Z");
    const collidingPath = path.join(archiveRoot, "2026-07-22T00-00-00-000Z-.astrograph");
    await mkdir(collidingPath, { recursive: true });

    await expect(archiveManagedDirectory({
      target,
      archiveRoot,
      reason: "test-collision",
      recoveryCommand: () => "astrograph cache restore --repo /repo --receipt /receipt --yes",
      now,
    })).rejects.toThrow(/archive collision/i);
    await expect(readFile(path.join(target, "payload.txt"), "utf8")).resolves.toBe("preserve these bytes");
  });

  it("leaves the original cache intact when the archive move fails", async () => {
    const { target, archiveRoot } = await createManagedCache();

    await expect(archiveManagedDirectory({
      target,
      archiveRoot,
      reason: "test-failed-move",
      recoveryCommand: (receiptPath) => `astrograph cache restore --repo /repo --receipt ${JSON.stringify(receiptPath)} --yes`,
      move: async () => { throw new Error("injected move failure"); },
    })).rejects.toThrow(/injected move failure/i);
    await expect(readFile(path.join(target, "payload.txt"), "utf8")).resolves.toBe("preserve these bytes");
    const receipts = (await readdir(archiveRoot)).filter((name) => name.endsWith(".receipt.json"));
    expect(receipts).toHaveLength(1);
    await expect(readFile(path.join(archiveRoot, receipts[0]!), "utf8")).resolves.toContain('"test-failed-move"');
  });

  it.skipIf(process.platform === "win32")("leaves the original cache intact when the archive root is unwritable", async () => {
    const { target, archiveRoot } = await createManagedCache();
    await mkdir(archiveRoot);
    await chmod(archiveRoot, 0o500);
    try {
      await expect(archiveManagedDirectory({
        target,
        archiveRoot,
        reason: "test-permissions",
        recoveryCommand: () => "astrograph cache restore --repo /repo --receipt /receipt --yes",
      })).rejects.toMatchObject({ code: "EACCES" });
      await expect(readFile(path.join(target, "payload.txt"), "utf8")).resolves.toBe("preserve these bytes");
    } finally {
      await chmod(archiveRoot, 0o700);
    }
  });
});
