import * as vscode from 'vscode';
import { IProvider, ProviderId } from './IProvider';
import { ClaudeCodeProvider } from './ClaudeCodeProvider';
import { CopilotProvider } from './CopilotProvider';

const providers: IProvider[] = [
  new ClaudeCodeProvider(),
  new CopilotProvider(),
];

export function getProvider(id: ProviderId): IProvider {
  const found = providers.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown provider: ${id}`);
  return found;
}

export function listProviders(): IProvider[] {
  return providers;
}

export async function resolveActiveProvider(workspaceRoot: string): Promise<IProvider> {
  const config = vscode.workspace.getConfiguration('aiHistoryExport');
  const settingId = config.get<string>('provider', 'auto');

  if (settingId !== 'auto') {
    return getProvider(settingId as ProviderId);
  }

  // Auto-detect: return first provider that detects itself as present
  for (const provider of providers) {
    if (await provider.detect(workspaceRoot)) {
      return provider;
    }
  }

  // Default to Claude Code
  return getProvider('claude-code');
}
