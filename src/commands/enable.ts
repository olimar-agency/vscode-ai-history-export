import * as vscode from 'vscode';
import { resolveActiveProvider } from '../providers/registry';
import { resolveScriptPath, assertScriptExists } from '../hook/ScriptResolver';
import { ensureHistoryFolder, offerGitignore } from '../workspace/HistoryFolder';
import { getHookScope, getExporterEnvVars, getNodeExecutable, getWorkspaceRoot } from '../workspace/SettingsBridge';

export async function enable(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('AI History Export: No workspace folder is open.');
    return;
  }

  const scriptPath = resolveScriptPath(context);
  assertScriptExists(scriptPath);

  const provider = await resolveActiveProvider(workspaceRoot);
  const scope = getHookScope();
  const envVars = getExporterEnvVars();
  const nodeExecutable = getNodeExecutable();

  provider.install(workspaceRoot, scope, scriptPath, envVars, nodeExecutable);
  ensureHistoryFolder(workspaceRoot);
  await offerGitignore(workspaceRoot);

  const open = await vscode.window.showInformationMessage(
    `AI History Export enabled via ${provider.displayName}. Sessions will be saved to HISTORY/.`,
    'Open HISTORY Folder'
  );

  if (open) {
    vscode.commands.executeCommand('aiHistory.openHistory');
  }
}
