import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export function resolveHistoryFolderPath(workspaceRoot: string): string {
  const config = vscode.workspace.getConfiguration('aiHistoryExport');
  const folderName = config.get<string>('historyFolderName', 'HISTORY');
  return path.join(workspaceRoot, folderName);
}

export function ensureHistoryFolder(workspaceRoot: string): string {
  const historyPath = resolveHistoryFolderPath(workspaceRoot);
  fs.mkdirSync(historyPath, { recursive: true });
  return historyPath;
}

export async function offerGitignore(workspaceRoot: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('aiHistoryExport');
  const folderName = config.get<string>('historyFolderName', 'HISTORY');
  const gitignorePath = path.join(workspaceRoot, '.gitignore');

  const entry = `\n# AI chat history export\n${folderName}/\n`;

  let existing = '';
  if (fs.existsSync(gitignorePath)) {
    existing = fs.readFileSync(gitignorePath, 'utf8');
  }

  if (existing.includes(`${folderName}/`)) return;

  const answer = await vscode.window.showInformationMessage(
    `Add "${folderName}/" to .gitignore?`,
    'Yes',
    'No'
  );

  if (answer === 'Yes') {
    fs.appendFileSync(gitignorePath, entry, 'utf8');
  }
}
