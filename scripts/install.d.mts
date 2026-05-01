export type InstallMode = "barebones" | "some" | "full";
export type InstallModeOptions = {
  ide?: "codex" | "copilot" | "copilot-cli";
  mode?: InstallMode;
  dryRun?: boolean;
};
export type InstallAllModeOptions = {
  ides?: ("codex" | "copilot" | "copilot-cli")[] | ("all" | "codex" | "copilot" | "copilot-cli")[];
  mode?: InstallMode;
  dryRun?: boolean;
};

export interface BaseInstallResult {
  ide: "copilot" | "copilot-cli" | "codex";
  mode: InstallMode;
  repoRoot: string;
  configPath: string;
  packageName: string;
  packageVersion: string;
  configPreview: string;
  localDependencyDetected: boolean;
}

export interface CodexInstallResult extends BaseInstallResult {
  ide: "codex";
}

export function setupForIde(
  repoRoot: string,
  options?: InstallModeOptions,
): Promise<BaseInstallResult>;

export function setupForAllIdes(
  repoRoot: string,
  options?: InstallAllModeOptions,
): Promise<BaseInstallResult | BaseInstallResult[]>;

export function setupForCodex(
  repoRoot: string,
  options?: Omit<InstallModeOptions, "ide">,
): Promise<CodexInstallResult>;
