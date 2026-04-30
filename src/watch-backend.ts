import { watch as fsWatch } from "node:fs";
import path from "node:path";

import type { WatchBackendKind } from "./types.ts";

export interface BackendWatchEvent {
  path: string;
  type: "create" | "update" | "delete" | "rename" | "unknown";
}

export interface WatchSubscription {
  backend: WatchBackendKind;
  close(): Promise<void>;
}

interface ParcelWatchEvent {
  path: string;
  type: "create" | "update" | "delete";
}

interface ParcelWatcherModule {
  subscribe(
    dir: string,
    callback: (
      error: Error | null,
      events: ParcelWatchEvent[],
    ) => void,
    options?: { ignore?: string[] },
  ): Promise<{
    unsubscribe(): Promise<void>;
  }>;
}

const WATCH_IGNORE_SEGMENTS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  ".astrograph",
  ".codeintel",
  "coverage",
  "dist",
  "node_modules",
]);

function isInsideRepo(relativePath: string): boolean {
  return (
    relativePath.length > 0
    && relativePath !== "."
    && relativePath !== ".."
    && !relativePath.startsWith(`..${path.sep}`)
  );
}

function shouldIgnoreWatchRelativePath(relativePath: string): boolean {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  return normalizedPath.split("/").some((segment) => WATCH_IGNORE_SEGMENTS.has(segment));
}

export function normalizeWatchAbsolutePath(
  repoRoot: string,
  candidatePath: string,
): string | null {
  const absolutePath = path.isAbsolute(candidatePath)
    ? candidatePath
    : path.join(repoRoot, candidatePath);
  const relativePath = path.relative(repoRoot, absolutePath);

  if (!isInsideRepo(relativePath)) {
    return null;
  }
  if (shouldIgnoreWatchRelativePath(relativePath)) {
    return null;
  }

  return relativePath;
}

export function normalizeParcelWatchEvents(
  repoRoot: string,
  events: ParcelWatchEvent[],
): BackendWatchEvent[] {
  return events.flatMap((event) => {
    const relativePath = normalizeWatchAbsolutePath(repoRoot, event.path);
    if (!relativePath) {
      return [];
    }

    return [{
      path: relativePath,
      type: event.type,
    }];
  });
}

export function normalizeNodeFsWatchEvent(
  repoRoot: string,
  eventType: string,
  filename: string | Buffer | null,
): BackendWatchEvent[] {
  if (!filename) {
    return [];
  }

  const relativePath = normalizeWatchAbsolutePath(repoRoot, String(filename));
  if (!relativePath) {
    return [];
  }

  return [{
    path: relativePath,
    type:
      eventType === "change"
        ? "update"
        : eventType === "rename"
          ? "rename"
          : "unknown",
  }];
}

export async function subscribeRepo(
  repoRoot: string,
  onEvents: (events: BackendWatchEvent[]) => void,
  options: {
    backend?: WatchBackendKind | "auto";
    onError?: (error: unknown) => void;
  } = {},
): Promise<WatchSubscription> {
  const preferredBackend = options.backend ?? "auto";

  if (preferredBackend === "parcel" || preferredBackend === "auto") {
    try {
      const parcelWatcher = await import("@parcel/watcher") as ParcelWatcherModule;
      const subscription = await parcelWatcher.subscribe(
        repoRoot,
        (error, events) => {
          if (error) {
            options.onError?.(error);
            return;
          }

          const normalizedEvents = normalizeParcelWatchEvents(repoRoot, events);
          if (normalizedEvents.length > 0) {
            onEvents(normalizedEvents);
          }
        },
        {
          ignore: [...WATCH_IGNORE_SEGMENTS].map((segment) => `${segment}/**`),
        },
      );

      return {
        backend: "parcel",
        async close() {
          await subscription.unsubscribe();
        },
      };
    } catch {
      if (preferredBackend === "parcel") {
        throw new Error("Requested parcel watch backend is unavailable");
      }
    }
  }

  if (preferredBackend === "polling") {
    throw new Error("Requested polling backend does not use a native subscription");
  }

  try {
    const watcher = fsWatch(
      repoRoot,
      { recursive: true },
      (eventType, filename) => {
        const normalizedEvents = normalizeNodeFsWatchEvent(repoRoot, eventType, filename);
        if (normalizedEvents.length > 0) {
          onEvents(normalizedEvents);
        }
      },
    );
    watcher.on("error", (error) => {
      options.onError?.(error);
    });

    return {
      backend: "node-fs-watch",
      async close() {
        watcher.close();
      },
    };
  } catch {
    if (preferredBackend === "node-fs-watch") {
      throw new Error("Requested node-fs-watch backend is unavailable");
    }
  }

  throw new Error("No native watch backend is available");
}
