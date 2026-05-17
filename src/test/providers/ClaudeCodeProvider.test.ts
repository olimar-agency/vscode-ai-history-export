import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ClaudeCodeProvider } from '../../providers/ClaudeCodeProvider';

const SCRIPT_PATH = '/fake/extension/assets/export-chat-history.js';
const SCRIPT_WITH_SPACES = '/fake/path with spaces/assets/export-chat-history.js';
const THIRD_PARTY_HOOK = {
  matcher: 'some-matcher',
  hooks: [{ type: 'command', command: 'node /other/tool.js', timeout: 30 }],
};

let tmpDir: string;
let provider: ClaudeCodeProvider;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-provider-test-'));
  provider = new ClaudeCodeProvider();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function settingsPath(): string {
  return path.join(tmpDir, '.claude', 'settings.json');
}

function readSettings(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
}

function writeSettings(content: Record<string, unknown>): void {
  const dir = path.dirname(settingsPath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(content, null, 2), 'utf8');
}

// ── EN: Enable ────────────────────────────────────────────────────────────────

describe('EN-01: install on workspace with no settings.json', () => {
  it('creates settings.json with nested Stop hook', () => {
    provider.install(tmpDir, 'project', SCRIPT_PATH, {});

    expect(fs.existsSync(settingsPath())).toBe(true);
    const s = readSettings() as { hooks: { Stop: { matcher: string; hooks: { command: string }[] }[] } };
    expect(s.hooks.Stop).toHaveLength(1);
    expect(s.hooks.Stop[0].matcher).toBe('');
    expect(s.hooks.Stop[0].hooks[0].command).toContain(SCRIPT_PATH);
    expect(s.hooks.Stop[0].hooks[0].command).toContain('node');
  });
});

describe('EN-02: install with existing settings.json without hooks', () => {
  it('adds hooks.Stop while preserving existing keys', () => {
    writeSettings({ someOtherKey: 'value' });
    provider.install(tmpDir, 'project', SCRIPT_PATH, {});

    const s = readSettings() as { someOtherKey: string; hooks: { Stop: unknown[] } };
    expect(s.someOtherKey).toBe('value');
    expect(s.hooks.Stop).toHaveLength(1);
  });
});

describe('EN-03: install is idempotent', () => {
  it('does not duplicate entries on repeated install', () => {
    provider.install(tmpDir, 'project', SCRIPT_PATH, {});
    provider.install(tmpDir, 'project', SCRIPT_PATH, {});
    provider.install(tmpDir, 'project', SCRIPT_PATH, {});

    const s = readSettings() as { hooks: { Stop: unknown[] } };
    expect(s.hooks.Stop).toHaveLength(1);
  });
});

describe('EN-04: install coexists with 3rd-party hooks', () => {
  it('appends our entry without removing 3rd-party Stop entries', () => {
    writeSettings({ hooks: { Stop: [THIRD_PARTY_HOOK] } });
    provider.install(tmpDir, 'project', SCRIPT_PATH, {});

    const s = readSettings() as { hooks: { Stop: unknown[] } };
    expect(s.hooks.Stop).toHaveLength(2);
    expect(s.hooks.Stop[0]).toMatchObject(THIRD_PARTY_HOOK);
  });
});

describe('EN-05: install with user scope', () => {
  it('resolveConfigPath returns homedir path for user scope', () => {
    const userPath = provider.resolveConfigPath('user', tmpDir);
    expect(userPath).toContain(os.homedir());
    expect(userPath).toContain('.claude');
  });
});

describe('EN-06: script path with spaces is quoted correctly', () => {
  it('wraps the path in double quotes in the command string', () => {
    provider.install(tmpDir, 'project', SCRIPT_WITH_SPACES, {});

    const s = readSettings() as { hooks: { Stop: { hooks: { command: string }[] }[] } };
    const cmd = s.hooks.Stop[0].hooks[0].command;
    expect(cmd).toContain(`"${SCRIPT_WITH_SPACES}"`);
  });
});

describe('EN-06b: env vars are injected into the command string', () => {
  it('prepends env vars before node invocation', () => {
    provider.install(tmpDir, 'project', SCRIPT_PATH, {
      HISTORY_FOLDER: 'MY_HISTORY',
      INCLUDE_DIAGNOSTICS: 'false',
    });

    const s = readSettings() as { hooks: { Stop: { hooks: { command: string }[] }[] } };
    const cmd = s.hooks.Stop[0].hooks[0].command;
    expect(cmd).toContain('HISTORY_FOLDER="MY_HISTORY"');
    expect(cmd).toContain('INCLUDE_DIAGNOSTICS="false"');
  });
});

// ── DI: Disable ───────────────────────────────────────────────────────────────

describe('DI-01: uninstall removes our hook', () => {
  it('removes extension-owned entry after install', () => {
    provider.install(tmpDir, 'project', SCRIPT_PATH, {});
    provider.uninstall(tmpDir, 'project');

    const s = readSettings() as { hooks?: { Stop?: unknown[] } };
    expect(s.hooks?.Stop).toBeUndefined();
  });
});

describe('DI-02: uninstall preserves 3rd-party hooks', () => {
  it('keeps other Stop entries intact', () => {
    writeSettings({ hooks: { Stop: [THIRD_PARTY_HOOK] } });
    provider.install(tmpDir, 'project', SCRIPT_PATH, {});
    provider.uninstall(tmpDir, 'project');

    const s = readSettings() as { hooks: { Stop: unknown[] } };
    expect(s.hooks.Stop).toHaveLength(1);
    expect(s.hooks.Stop[0]).toMatchObject(THIRD_PARTY_HOOK);
  });
});

describe('DI-03: uninstall when no config file', () => {
  it('does not throw', () => {
    expect(() => provider.uninstall(tmpDir, 'project')).not.toThrow();
  });
});

describe('DI-04: uninstall leaves valid JSON and cleans empty nodes', () => {
  it('removes hooks and hooks.Stop keys when both become empty', () => {
    provider.install(tmpDir, 'project', SCRIPT_PATH, {});
    provider.uninstall(tmpDir, 'project');

    const raw = fs.readFileSync(settingsPath(), 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();

    const s = JSON.parse(raw) as Record<string, unknown>;
    expect(s.hooks).toBeUndefined();
  });
});

// ── RE: Repair ────────────────────────────────────────────────────────────────

describe('RE-02: repair updates stale script path', () => {
  it('replaces old command with new script path', () => {
    const oldPath = '/old/extension/v1/assets/export-chat-history.js';
    const newPath = '/new/extension/v2/assets/export-chat-history.js';

    provider.install(tmpDir, 'project', oldPath, {});
    provider.install(tmpDir, 'project', newPath, {});

    const s = readSettings() as { hooks: { Stop: { hooks: { command: string }[] }[] } };
    expect(s.hooks.Stop).toHaveLength(1);
    expect(s.hooks.Stop[0].hooks[0].command).toContain(newPath);
    expect(s.hooks.Stop[0].hooks[0].command).not.toContain(oldPath);
  });
});

// ── VA: Validate ──────────────────────────────────────────────────────────────

describe('VA-01: validate with correct installation', () => {
  it('returns ok=true when hook and script are present', () => {
    // Write the fake script so fs.existsSync passes
    const fakeScript = path.join(tmpDir, 'export-chat-history.js');
    fs.writeFileSync(fakeScript, '// fake', 'utf8');

    provider.install(tmpDir, 'project', fakeScript, {});
    const report = provider.validate(tmpDir, 'project', fakeScript);

    expect(report.ok).toBe(true);
    expect(report.issues).toHaveLength(0);
  });
});

describe('VA-02: validate with missing script', () => {
  it('reports the missing script path as an issue', () => {
    provider.install(tmpDir, 'project', SCRIPT_PATH, {});
    const report = provider.validate(tmpDir, 'project', SCRIPT_PATH);

    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.includes(SCRIPT_PATH))).toBe(true);
  });
});

describe('VA: validate with no settings file', () => {
  it('reports missing config as an issue', () => {
    const report = provider.validate(tmpDir, 'project', SCRIPT_PATH);

    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.includes('settings.json'))).toBe(true);
  });
});

describe('VA: validate when hook not installed', () => {
  it('reports missing hook entry', () => {
    writeSettings({ someKey: 'value' });
    const fakeScript = path.join(tmpDir, 'export-chat-history.js');
    fs.writeFileSync(fakeScript, '// fake', 'utf8');

    const report = provider.validate(tmpDir, 'project', fakeScript);

    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.toLowerCase().includes('hook'))).toBe(true);
  });
});

// ── isInstalled ───────────────────────────────────────────────────────────────

describe('isInstalled', () => {
  it('returns false before install', () => {
    expect(provider.isInstalled(tmpDir, 'project')).toBe(false);
  });

  it('returns true after install', () => {
    provider.install(tmpDir, 'project', SCRIPT_PATH, {});
    expect(provider.isInstalled(tmpDir, 'project')).toBe(true);
  });

  it('returns false after uninstall', () => {
    provider.install(tmpDir, 'project', SCRIPT_PATH, {});
    provider.uninstall(tmpDir, 'project');
    expect(provider.isInstalled(tmpDir, 'project')).toBe(false);
  });
});
