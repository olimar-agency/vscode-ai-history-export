export type ProviderId = 'claude-code' | 'copilot' | 'cursor' | 'continue' | 'windsurf';

export type HookScope = 'project' | 'user';

export interface ValidationReport {
  ok: boolean;
  issues: string[];
}

export interface IProvider {
  id: ProviderId;
  displayName: string;
  supportsAutoHook: boolean;

  detect(workspaceRoot: string): Promise<boolean>;
  resolveConfigPath(scope: HookScope, workspaceRoot: string): string;
  isInstalled(workspaceRoot: string, scope: HookScope): boolean;
  install(workspaceRoot: string, scope: HookScope, scriptAbsPath: string, envVars: Record<string, string>): void;
  uninstall(workspaceRoot: string, scope: HookScope): void;
  validate(workspaceRoot: string, scope: HookScope, scriptAbsPath: string): ValidationReport;
}
