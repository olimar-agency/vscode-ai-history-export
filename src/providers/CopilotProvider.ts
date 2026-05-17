import * as fs from 'fs';
import * as vscode from 'vscode';
import { IProvider, HookScope, ProviderId, ValidationReport } from './IProvider';

/**
 * Copilot does not expose a Stop hook or public chat session API.
 * This provider supports manual export only: the user invokes
 * "AI History: Save current chat to HISTORY/" explicitly.
 */
export class CopilotProvider implements IProvider {
  id: ProviderId = 'copilot';
  displayName = 'GitHub Copilot';
  supportsAutoHook = false;

  async detect(_workspaceRoot: string): Promise<boolean> {
    const ext = vscode.extensions.getExtension('GitHub.copilot-chat');
    return ext !== undefined;
  }

  resolveConfigPath(_scope: HookScope, _workspaceRoot: string): string {
    return '';
  }

  isInstalled(_workspaceRoot: string, _scope: HookScope): boolean {
    return true; // Manual export is always "installed" — no config to write
  }

  install(_workspaceRoot: string, _scope: HookScope, _scriptAbsPath: string, _envVars: Record<string, string>): void {
    // No-op: Copilot has no hook mechanism. Export is triggered manually.
  }

  uninstall(_workspaceRoot: string, _scope: HookScope): void {
    // No-op
  }

  validate(_workspaceRoot: string, _scope: HookScope, scriptAbsPath: string): ValidationReport {
    const issues: string[] = [];

    if (!fs.existsSync(scriptAbsPath)) {
      issues.push(`Exporter script not found: ${scriptAbsPath}`);
    }

    issues.push(
      'GitHub Copilot does not expose a Stop hook. Export is manual: use "AI History Export: Save current Copilot chat to HISTORY/".'
    );

    return { ok: issues.length === 1, issues }; // The manual-export note is informational, not an error
  }
}
