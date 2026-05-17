import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { IProvider, HookScope, ProviderId, ValidationReport } from './IProvider';

const INSTALLED_BY = 'ai-history-export';

export class ClaudeCodeProvider implements IProvider {
  id: ProviderId = 'claude-code';
  displayName = 'Claude Code';
  supportsAutoHook = true;

  async detect(workspaceRoot: string): Promise<boolean> {
    return (
      fs.existsSync(path.join(workspaceRoot, '.claude', 'settings.json')) ||
      fs.existsSync(path.join(os.homedir(), '.claude', 'settings.json'))
    );
  }

  resolveConfigPath(scope: HookScope, workspaceRoot: string): string {
    if (scope === 'user') {
      return path.join(os.homedir(), '.claude', 'settings.json');
    }
    return path.join(workspaceRoot, '.claude', 'settings.json');
  }

  isInstalled(workspaceRoot: string, scope: HookScope): boolean {
    const configPath = this.resolveConfigPath(scope, workspaceRoot);
    if (!fs.existsSync(configPath)) return false;
    try {
      const settings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return this._findOurEntry(settings) !== null;
    } catch {
      return false;
    }
  }

  install(workspaceRoot: string, scope: HookScope, scriptAbsPath: string, envVars: Record<string, string>): void {
    const configPath = this.resolveConfigPath(scope, workspaceRoot);
    const settings = this._readSettings(configPath);

    if (!settings.hooks) settings.hooks = {};
    if (!Array.isArray(settings.hooks.Stop)) settings.hooks.Stop = [];

    // Remove any existing entry owned by this extension
    settings.hooks.Stop = (settings.hooks.Stop as object[]).filter(
      (entry: object) => !this._isOurEntry(entry)
    );

    const envPrefix = Object.entries(envVars)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    const command = envPrefix
      ? `${envPrefix} node "${scriptAbsPath}"`
      : `node "${scriptAbsPath}"`;

    settings.hooks.Stop.push({
      matcher: '',
      hooks: [
        {
          type: 'command',
          command,
          timeout: 60,
          _installedBy: INSTALLED_BY,
        },
      ],
    });

    this._writeSettings(configPath, settings);
  }

  uninstall(workspaceRoot: string, scope: HookScope): void {
    const configPath = this.resolveConfigPath(scope, workspaceRoot);
    if (!fs.existsSync(configPath)) return;

    const settings = this._readSettings(configPath);
    if (!settings.hooks?.Stop) return;

    settings.hooks.Stop = (settings.hooks.Stop as object[]).filter(
      (entry: object) => !this._isOurEntry(entry)
    );

    if ((settings.hooks.Stop as object[]).length === 0) delete settings.hooks.Stop;
    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

    this._writeSettings(configPath, settings);
  }

  validate(workspaceRoot: string, scope: HookScope, scriptAbsPath: string): ValidationReport {
    const issues: string[] = [];
    const configPath = this.resolveConfigPath(scope, workspaceRoot);

    if (!fs.existsSync(configPath)) {
      issues.push(`Settings file not found: ${configPath}`);
    } else {
      try {
        const settings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (!this._findOurEntry(settings)) {
          issues.push('Hook entry not found in settings file. Run "Enable for Workspace" to install.');
        }
      } catch {
        issues.push(`Settings file could not be parsed: ${configPath}`);
      }
    }

    if (!fs.existsSync(scriptAbsPath)) {
      issues.push(`Exporter script not found: ${scriptAbsPath}`);
    }

    return { ok: issues.length === 0, issues };
  }

  private _readSettings(configPath: string): Record<string, unknown> {
    if (!fs.existsSync(configPath)) return {};
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      return {};
    }
  }

  private _writeSettings(configPath: string, settings: Record<string, unknown>): void {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Atomic write via temp file
    const tmp = `${configPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2), 'utf8');
    fs.renameSync(tmp, configPath);
  }

  private _isOurEntry(entry: object): boolean {
    const e = entry as Record<string, unknown>;
    if (Array.isArray(e.hooks)) {
      return (e.hooks as Record<string, unknown>[]).some(
        (h) => h._installedBy === INSTALLED_BY
      );
    }
    return false;
  }

  private _findOurEntry(settings: Record<string, unknown>): object | null {
    const stop = (settings.hooks as Record<string, unknown[]> | undefined)?.Stop;
    if (!Array.isArray(stop)) return null;
    return stop.find((entry) => this._isOurEntry(entry as object)) ?? null;
  }
}
