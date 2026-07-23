import { describe, expect, it, vi } from "vitest";

import { fetchLatestNpmVersion } from "../src/lib/npm-registry.ts";

describe("fetchLatestNpmVersion", () => {
  it("reads the latest dist-tag from the default registry", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ latest: "1.2.3" }),
      { status: 200 },
    ));

    await expect(fetchLatestNpmVersion({ packageName: "astrograph", timeoutMs: 20, fetchImplementation }))
      .resolves.toBe("1.2.3");
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://registry.npmjs.org/-/package/astrograph/dist-tags",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("uses a supplied registry URL and safely encodes scoped package names", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ latest: "4.5.6" }),
      { status: 200 },
    ));

    await expect(fetchLatestNpmVersion({
      packageName: "@scope/package",
      timeoutMs: 20,
      registryUrl: "https://registry.example.test/npm/",
      fetchImplementation,
    })).resolves.toBe("4.5.6");
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://registry.example.test/npm/-/package/%40scope%2Fpackage/dist-tags",
      expect.anything(),
    );
  });

  it("uses npm_config_registry when a caller does not supply a registry URL", async () => {
    const previousRegistry = process.env.npm_config_registry;
    process.env.npm_config_registry = "https://registry.example.test/custom";
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ latest: "7.8.9" }),
      { status: 200 },
    ));

    try {
      await expect(fetchLatestNpmVersion({ packageName: "astrograph", timeoutMs: 20, fetchImplementation }))
        .resolves.toBe("7.8.9");
      expect(fetchImplementation).toHaveBeenCalledWith(
        "https://registry.example.test/custom/-/package/astrograph/dist-tags",
        expect.anything(),
      );
    } finally {
      if (previousRegistry === undefined) {
        delete process.env.npm_config_registry;
      } else {
        process.env.npm_config_registry = previousRegistry;
      }
    }
  });

  it("rejects HTTP and malformed-registry responses", async () => {
    await expect(fetchLatestNpmVersion({
      packageName: "astrograph",
      timeoutMs: 20,
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(new Response("not found", { status: 404 })),
    })).rejects.toThrow("npm registry returned HTTP 404");

    await expect(fetchLatestNpmVersion({
      packageName: "astrograph",
      timeoutMs: 20,
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 })),
    })).rejects.toThrow("npm registry returned no latest dist-tag");
  });

  it("aborts a request that exceeds the caller timeout", async () => {
    const fetchImplementation = vi.fn<typeof fetch>((_url, init) => new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));

    await expect(fetchLatestNpmVersion({ packageName: "astrograph", timeoutMs: 1, fetchImplementation }))
      .rejects.toThrow("npm registry lookup timed out after 1ms");
  });
});
