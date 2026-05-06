import path from "node:path";
import { writeFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  getSymbolSource,
  indexFolder,
  searchSymbols,
} from "../src/index.ts";
import { parseSourceFile } from "../src/parser.ts";
import { cleanupFixtureRepos, createFixtureRepo } from "./fixture-repo.ts";

afterEach(async () => {
  await cleanupFixtureRepos();
});

describe("stable symbol identity", () => {
  it("keeps semantic stable ids across line shifts and duplicate members", () => {
    const original = parseSourceFile({
      relativePath: "src/service.ts",
      language: "ts",
      content: `
class Service {
  get status() {
    return "ok";
  }

  set status(value: string) {
    void value;
  }

  run() {
    return this.status;
  }
}
`,
    });

    const shifted = parseSourceFile({
      relativePath: "src/service.ts",
      language: "ts",
      content: `
// heading

class Service {
  get status() {
    return "ok";
  }

  set status(value: string) {
    void value;
  }

  run() {
    return this.status;
  }
}
`,
    });

    expect(original.symbols.map((symbol) => symbol.stableId)).toEqual([
      "src/service.ts:class:Service",
      "src/service.ts:method:Service.status",
      "src/service.ts:method:Service.status#2",
      "src/service.ts:method:Service.run",
    ]);
    expect(shifted.symbols.map((symbol) => symbol.stableId)).toEqual(
      original.symbols.map((symbol) => symbol.stableId),
    );
  });

  it("resolves both stable ids and legacy ids after a symbol shifts lines", async () => {
    const repoRoot = await createFixtureRepo();

    await indexFolder({ repoRoot });

    const firstMatch = (
      await searchSymbols({
        repoRoot,
        query: "area",
      })
    )[0];

    expect(firstMatch?.stableId).toBe("src/math.ts:function:area");

    await writeFile(
      path.join(repoRoot, "src", "math.ts"),
      `// shifted
import { formatLabel } from "./strings.js";

export const PI = 3.14;

/** Calculate the circle area label. */
export function area(radius: number): string {
  const value = PI * radius * radius;
  return formatLabel(value);
}
`,
    );

    await indexFolder({ repoRoot });

    const shiftedMatch = (
      await searchSymbols({
        repoRoot,
        query: "area",
      })
    )[0];

    expect(shiftedMatch?.stableId).toBe("src/math.ts:function:area");
    expect(shiftedMatch?.id).not.toBe(firstMatch?.id);

    const byStableId = await getSymbolSource({
      repoRoot,
      symbolId: shiftedMatch!.stableId,
    });
    expect(byStableId.symbol).toMatchObject({
      name: "area",
      stableId: "src/math.ts:function:area",
    });

    const byLegacyId = await getSymbolSource({
      repoRoot,
      symbolId: firstMatch!.id,
    });
    expect(byLegacyId.symbol).toMatchObject({
      name: "area",
      stableId: "src/math.ts:function:area",
    });
  });
});
