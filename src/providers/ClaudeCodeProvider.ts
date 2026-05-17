import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { IProvider, HookScope, ProviderId, ValidationReport } from './IProvider';

const INSTALLED_BY = 'ai-history-export';

type HookEntry = { matcher: string; hooks: { type: string; command: string; timeout: number; _installedBy?: string }[] };
type ClaudeSettings = { hooks?: { Stop?: HookEntry[] } } & Record<string, unknown>;

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
      const settings = this._readSettings(configPath);
      return this._findOurEntry(settings) !== undefined;
    } catch {
      return false;
    }
  }

  install(workspaceRoot: string, scope: HookScope, scriptAbsPath: string, envVars: Record<string, string>, nodeExecutable = 'node'): void {
    const configPath = this.resolveConfigPath(scope, workspaceRoot);
    const settings = this._readSettings(configPath);

    if (!settings.hooks) settings.hooks = {};
    if (!Array.isArray(settings.hooks.Stop)) settings.hooks.Stop = [];

    settings.hooks.Stop = settings.hooks.Stop.filter((entry) => !this._isOurEntry(entry));

    const envPrefix = Object.entries(envVars)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    const nodeCmd = nodeExecutable.includes(' ') ? `"${nodeExecutable}"` : nodeExecutable;
    const command = envPrefix
      ? `${envPrefix} ${nodeCmd} "${scriptAbsPath}"`
      : `${nodeCmd} "${scriptAbsPath}"`;

    settings.hooks.Stop.push({
      matcher: '',
      hooks: [{ type: 'command', command, timeout: 60, _installedBy: INSTALLED_BY }],
    });

    this._writeSettings(configPath, settings);
  }

  uninstall(workspaceRoot: string, scope: HookScope): void {
    const configPath = this.resolveConfigPath(scope, workspaceRoot);
    if (!fs.existsSync(configPath)) return;

    const settings = this._readSettings(configPath);
    if (!settings.hooks?.Stop) return;

    settings.hooks.Stop = settings.hooks.Stop.filter((entry) => !this._isOurEntry(entry));

    if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;
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
        const settings = this._readSettings(configPath);
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

  private _readSettings(configPath: string): ClaudeSettings {
    if (!fs.existsSync(configPath)) return {};
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8')) as ClaudeSettings;
    } catch {
      return {};
    }
  }

  private _writeSettings(configPath: string, settings: ClaudeSettings): void {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const tmp = `${configPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2), 'utf8');
    fs.renameSync(tmp, configPath);
  }

  private _isOurEntry(entry: HookEntry): boolean {
    return entry.hooks?.some((h) => h._installedBy === INSTALLED_BY) ?? false;
  }

  private _findOurEntry(settings: ClaudeSettings): HookEntry | undefined {
    return settings.hooks?.Stop?.find((entry) => this._isOurEntry(entry));
  }
}
