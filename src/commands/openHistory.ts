import * as vscode from 'vscode';
import { ensureHistoryFolder } from '../workspace/HistoryFolder';
import { getWorkspaceRoot } from '../workspace/SettingsBridge';

export function openHistory(): void {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('AI History Export: No workspace folder is open.');
    return;
  }

  const historyPath = ensureHistoryFolder(workspaceRoot);
  vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(historyPath));
}
