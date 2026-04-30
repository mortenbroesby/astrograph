export interface CodexInstallResult {
  ide: "codex";
  repoRoot: string;
  configPath: string;
  packageName: string;
  packageVersion: string;
  configPreview: string;
  localDependencyDetected: boolean;
}

export function installForCodex(
  repoRoot: string,
  options?: { dryRun?: boolean },
): Promise<CodexInstallResult>;
