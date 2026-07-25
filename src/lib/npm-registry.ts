const DEFAULT_NPM_REGISTRY_URL = "https://registry.npmjs.org";

export interface FetchLatestNpmVersionOptions {
  packageName: string;
  timeoutMs: number;
  registryUrl?: string;
  fetchImplementation?: typeof fetch;
}

function registryDistTagsUrl(packageName: string, registryUrl: string): string {
  return `${registryUrl.replace(/\/$/, "")}/-/package/${encodeURIComponent(packageName)}/dist-tags`;
}

function latestVersionFromDistTags(value: unknown): string {
  if (
    value === null
    || typeof value !== "object"
    || typeof (value as { latest?: unknown }).latest !== "string"
    || (value as { latest: string }).latest.trim().length === 0
  ) {
    throw new Error("npm registry returned no latest dist-tag");
  }

  return (value as { latest: string }).latest.trim();
}

export async function fetchLatestNpmVersion({
  packageName,
  timeoutMs,
  registryUrl = process.env.npm_config_registry ?? DEFAULT_NPM_REGISTRY_URL,
  fetchImplementation = fetch,
}: FetchLatestNpmVersionOptions): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error(`npm registry lookup timed out after ${timeoutMs}ms`)),
    timeoutMs,
  );

  try {
    const response = await fetchImplementation(registryDistTagsUrl(packageName, registryUrl), {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`npm registry returned HTTP ${response.status}`);
    }

    return latestVersionFromDistTags(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}
