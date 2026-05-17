import * as vscode from 'vscode';
import * as cp from 'child_process';
import { resolveActiveProvider } from '../providers/registry';
import { resolveScriptPath } from '../hook/ScriptResolver';
import { getHookScope, getNodeExecutable, getWorkspaceRoot } from '../workspace/SettingsBridge';

export async function validate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('AI History Export: No workspace folder is open.');
    return;
  }

  const output = vscode.window.createOutputChannel('AI History Export');
  output.show();
  output.appendLine('--- AI History Export: Validation ---\n');

  // Check Node.js
  const nodeExecutable = getNodeExecutable();
  try {
    const nodeVersion = cp.execSync(`"${nodeExecutable}" --version`, { encoding: 'utf8' }).trim();
    output.appendLine(`✓ Node.js (${nodeExecutable}): ${nodeVersion}`);
  } catch {
    output.appendLine(
      `✗ Node.js not found at "${nodeExecutable}". ` +
      `Install Node.js 18+ or set aiHistoryExport.nodePath to the full path of your node executable.`
    );
  }

  // Check exporter script
  const scriptPath = resolveScriptPath(context);
  const fs = await import('fs');
  if (fs.existsSync(scriptPath)) {
    output.appendLine(`✓ Exporter script: ${scriptPath}`);
  } else {
    output.appendLine(`✗ Exporter script missing: ${scriptPath}`);
  }

  // Check provider hook
  const provider = await resolveActiveProvider(workspaceRoot);
  const scope = getHookScope();
  output.appendLine(`\nProvider: ${provider.displayName} (scope: ${scope})`);

  const report = provider.validate(workspaceRoot, scope, scriptPath);
  if (report.ok) {
    output.appendLine('✓ Hook configuration is valid.');
  } else {
    for (const issue of report.issues) {
      output.appendLine(`  • ${issue}`);
    }
  }

  output.appendLine('\n--- Done ---');
}
