import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

export function resolveScriptPath(context: vscode.ExtensionContext): string {
  return path.join(context.extensionPath, 'assets', 'export-chat-history.js');
}

export function assertScriptExists(scriptPath: string): void {
  if (!fs.existsSync(scriptPath)) {
    throw new Error(
      `Exporter script not found at ${scriptPath}. The extension may be corrupted — try reinstalling.`
    );
  }
}
