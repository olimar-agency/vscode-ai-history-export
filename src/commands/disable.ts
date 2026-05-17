import * as vscode from 'vscode';
import { resolveActiveProvider } from '../providers/registry';
import { getHookScope, getWorkspaceRoot } from '../workspace/SettingsBridge';

export async function disable(): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('AI History Export: No workspace folder is open.');
    return;
  }

  const provider = await resolveActiveProvider(workspaceRoot);
  const scope = getHookScope();

  provider.uninstall(workspaceRoot, scope);

  vscode.window.showInformationMessage(
    `AI History Export disabled for ${provider.displayName}. Your HISTORY/ folder is untouched.`
  );
}
