import * as vscode from 'vscode';
import { HookScope } from '../providers/IProvider';

export function getHookScope(): HookScope {
  const config = vscode.workspace.getConfiguration('aiHistoryExport');
  return config.get<HookScope>('hookScope', 'project');
}

export function getExporterEnvVars(): Record<string, string> {
  const config = vscode.workspace.getConfiguration('aiHistoryExport');
  return {
    HISTORY_FOLDER: config.get<string>('historyFolderName', 'HISTORY'),
    INCLUDE_DIAGNOSTICS: config.get<boolean>('includeDiagnostics', true) ? 'true' : 'false',
  };
}

export function getNodeExecutable(): string {
  const config = vscode.workspace.getConfiguration('aiHistoryExport');
  return config.get<string>('nodePath', '').trim() || 'node';
}

export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}
