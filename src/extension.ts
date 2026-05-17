import * as vscode from 'vscode';
import { enable } from './commands/enable';
import { disable } from './commands/disable';
import { openHistory } from './commands/openHistory';
import { repair } from './commands/repair';
import { validate } from './commands/validate';
import { resolveActiveProvider } from './providers/registry';
import { resolveScriptPath } from './hook/ScriptResolver';
import { getHookScope, getExporterEnvVars, getNodeExecutable, getWorkspaceRoot } from './workspace/SettingsBridge';

const STATE_KEY_VERSION = 'installedExtensionVersion';

async function autoRepairIfUpdated(context: vscode.ExtensionContext): Promise<void> {
  const currentVersion = context.extension.packageJSON.version as string;
  const previousVersion = context.globalState.get<string>(STATE_KEY_VERSION);

  if (previousVersion === currentVersion) return;

  // Version changed (fresh install or update) — re-write hook with current script path
  const workspaceRoot = getWorkspaceRoot();
  if (workspaceRoot) {
    try {
      const provider = await resolveActiveProvider(workspaceRoot);
      if (provider.isInstalled(workspaceRoot, getHookScope())) {
        const scriptPath = resolveScriptPath(context);
        provider.install(workspaceRoot, getHookScope(), scriptPath, getExporterEnvVars(), getNodeExecutable());
      }
    } catch {
      // Non-fatal — user can run Repair manually
    }
  }

  await context.globalState.update(STATE_KEY_VERSION, currentVersion);
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('aiHistory.enable',      () => enable(context)),
    vscode.commands.registerCommand('aiHistory.disable',     () => disable()),
    vscode.commands.registerCommand('aiHistory.openHistory', () => openHistory()),
    vscode.commands.registerCommand('aiHistory.repair',      () => repair(context)),
    vscode.commands.registerCommand('aiHistory.validate',    () => validate(context)),
  );

  autoRepairIfUpdated(context);
}

export function deactivate(): void {}
