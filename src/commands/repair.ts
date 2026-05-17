import * as vscode from 'vscode';
import { resolveActiveProvider } from '../providers/registry';
import { resolveScriptPath, assertScriptExists } from '../hook/ScriptResolver';
import { getHookScope, getExporterEnvVars, getWorkspaceRoot } from '../workspace/SettingsBridge';

export async function repair(context: vscode.ExtensionContext): Promise<void> {
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

  // Re-install rewrites the hook entry with the current script path and env vars
  provider.install(workspaceRoot, scope, scriptPath, envVars);

  vscode.window.showInformationMessage(
    `AI History Export: Configuration repaired for ${provider.displayName}.`
  );
}
