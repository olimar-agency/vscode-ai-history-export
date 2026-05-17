import * as vscode from 'vscode';
import { enable } from './commands/enable';
import { disable } from './commands/disable';
import { openHistory } from './commands/openHistory';
import { repair } from './commands/repair';
import { validate } from './commands/validate';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('aiHistory.enable',      () => enable(context)),
    vscode.commands.registerCommand('aiHistory.disable',     () => disable()),
    vscode.commands.registerCommand('aiHistory.openHistory', () => openHistory()),
    vscode.commands.registerCommand('aiHistory.repair',      () => repair(context)),
    vscode.commands.registerCommand('aiHistory.validate',    () => validate(context)),
  );
}

export function deactivate(): void {}
