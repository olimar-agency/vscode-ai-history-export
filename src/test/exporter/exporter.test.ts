import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

const SCRIPT = path.resolve(__dirname, '../../../assets/export-chat-history.js');

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exporter-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function run(
  payload: Record<string, unknown>,
  env: Record<string, string> = {}
): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync('node', [SCRIPT], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
  };
}

function historyFiles(folder = 'HISTORY'): string[] {
  const dir = path.join(tmpDir, folder);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('_chat.md'));
}

function readFirstFile(folder = 'HISTORY'): string {
  const files = historyFiles(folder);
  expect(files.length).toBeGreaterThan(0);
  return fs.readFileSync(path.join(tmpDir, folder, files[0]), 'utf8');
}

// ── HK-02: camelCase payload ──────────────────────────────────────────────────

describe('HK-02: camelCase payload fields', () => {
  it('creates a Markdown file in HISTORY/', () => {
    run(
      { hookEventName: 'Stop', sessionId: 'abc-camel-123', cwd: tmpDir, stopHookActive: false },
    );
    expect(historyFiles()).toHaveLength(1);
  });

  it('includes sessionId in the output file', () => {
    run(
      { hookEventName: 'Stop', sessionId: 'abc-camel-123', cwd: tmpDir, stopHookActive: false },
    );
    const content = readFirstFile();
    expect(content).toContain('abc-camel-123');
  });
});

// ── HK-03: snake_case payload ─────────────────────────────────────────────────

describe('HK-03: snake_case payload fields', () => {
  it('creates a Markdown file in HISTORY/', () => {
    run(
      { hook_event_name: 'Stop', session_id: 'abc-snake-456', cwd: tmpDir, stop_hook_active: false },
    );
    expect(historyFiles()).toHaveLength(1);
  });

  it('includes session_id in the output file', () => {
    run(
      { hook_event_name: 'Stop', session_id: 'abc-snake-456', cwd: tmpDir, stop_hook_active: false },
    );
    const content = readFirstFile();
    expect(content).toContain('abc-snake-456');
  });
});

// ── Recursion protection ──────────────────────────────────────────────────────

describe('recursion protection', () => {
  it('exits early and does not create a file when stopHookActive=true', () => {
    run({ hookEventName: 'Stop', sessionId: 'rec-test', cwd: tmpDir, stopHookActive: true });
    expect(historyFiles()).toHaveLength(0);
  });

  it('exits early when stop_hook_active=true', () => {
    run({ hook_event_name: 'Stop', session_id: 'rec-test', cwd: tmpDir, stop_hook_active: true });
    expect(historyFiles()).toHaveLength(0);
  });
});

// ── Session file reuse ────────────────────────────────────────────────────────

describe('session file reuse', () => {
  it('updates the same file on second run with same sessionId', () => {
    const payload = { hookEventName: 'Stop', sessionId: 'reuse-session-id', cwd: tmpDir, stopHookActive: false };
    run(payload);
    run(payload);

    expect(historyFiles()).toHaveLength(1);
  });

  it('creates separate files for different sessionIds', () => {
    run({ hookEventName: 'Stop', sessionId: 'session-aaa', cwd: tmpDir, stopHookActive: false });
    run({ hookEventName: 'Stop', sessionId: 'session-bbb', cwd: tmpDir, stopHookActive: false });

    expect(historyFiles()).toHaveLength(2);
  });
});

// ── Fallback on missing transcript ────────────────────────────────────────────

describe('fallback behavior', () => {
  it('produces a Markdown file even with no transcript path', () => {
    run({ hookEventName: 'Stop', sessionId: 'no-transcript', cwd: tmpDir, stopHookActive: false });
    expect(historyFiles()).toHaveLength(1);
  });

  it('output file contains # Chat History header', () => {
    run({ hookEventName: 'Stop', sessionId: 'no-transcript', cwd: tmpDir, stopHookActive: false });
    expect(readFirstFile()).toContain('# Chat History');
  });
});

// ── HISTORY_FOLDER env var ────────────────────────────────────────────────────

describe('HISTORY_FOLDER env var', () => {
  it('writes to custom folder name when HISTORY_FOLDER is set', () => {
    run(
      { hookEventName: 'Stop', sessionId: 'env-folder', cwd: tmpDir, stopHookActive: false },
      { HISTORY_FOLDER: 'CHAT_LOG' }
    );
    expect(historyFiles('CHAT_LOG')).toHaveLength(1);
    expect(historyFiles('HISTORY')).toHaveLength(0);
  });
});

// ── INCLUDE_DIAGNOSTICS env var ───────────────────────────────────────────────

describe('INCLUDE_DIAGNOSTICS env var', () => {
  it('omits diagnostics sections when INCLUDE_DIAGNOSTICS=false', () => {
    run(
      { hookEventName: 'Stop', sessionId: 'no-diag', cwd: tmpDir, stopHookActive: false },
      { INCLUDE_DIAGNOSTICS: 'false' }
    );
    const content = readFirstFile();
    expect(content).not.toContain('## Diagnostics');
    expect(content).not.toContain('## Hook Payload');
  });

  it('includes diagnostics sections when INCLUDE_DIAGNOSTICS=true', () => {
    run(
      { hookEventName: 'Stop', sessionId: 'with-diag', cwd: tmpDir, stopHookActive: false },
      { INCLUDE_DIAGNOSTICS: 'true' }
    );
    const content = readFirstFile();
    expect(content).toContain('## Hook Payload');
  });
});

// ── stdout response ───────────────────────────────────────────────────────────

describe('stdout response', () => {
  it('always outputs valid JSON with continue:true', () => {
    const { stdout } = run({ hookEventName: 'Stop', sessionId: 'stdout-test', cwd: tmpDir, stopHookActive: false });
    const parsed = JSON.parse(stdout);
    expect(parsed.continue).toBe(true);
  });

  it('outputs continue:true even on recursion guard', () => {
    const { stdout } = run({ hookEventName: 'Stop', sessionId: 'rec', cwd: tmpDir, stopHookActive: true });
    const parsed = JSON.parse(stdout);
    expect(parsed.continue).toBe(true);
  });
});

// ── Markdown structure ────────────────────────────────────────────────────────

describe('Markdown output structure', () => {
  it('contains required sections', () => {
    run({ hookEventName: 'Stop', sessionId: 'structure-test', cwd: tmpDir, stopHookActive: false });
    const content = readFirstFile();
    expect(content).toContain('# Chat History');
    expect(content).toContain('## Conversation');
    expect(content).toContain('## Handoff');
  });

  it('filename follows YYYY-MM-DD_HH-mm-ss_<slug>_chat.md pattern', () => {
    run({ hookEventName: 'Stop', sessionId: 'slug-check-session', cwd: tmpDir, stopHookActive: false });
    const [file] = historyFiles();
    expect(file).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_.*_chat\.md$/);
  });
});
