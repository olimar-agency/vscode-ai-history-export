#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

async function readStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf8').trim();
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getHookValue(hookInput, ...keys) {
  for (const key of keys) {
    const value = hookInput && hookInput[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'boolean') {
      return value;
    }
  }

  return '';
}

function formatTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return {
    iso: date.toISOString(),
    fileStamp: `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`,
  };
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function slugifySessionId(sessionId) {
  return (sessionId || 'unknown-session').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 24);
}

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

function stringifyContent(content) {
  if (content == null) {
    return '';
  }

  if (typeof content === 'string') {
    return normalizeWhitespace(content);
  }

  if (Array.isArray(content)) {
    return normalizeWhitespace(
      content
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }

          if (item && typeof item.text === 'string') {
            return item.text;
          }

          if (item && typeof item.value === 'string') {
            return item.value;
          }

          if (item && typeof item.content === 'string') {
            return item.content;
          }

          return JSON.stringify(item, null, 2);
        })
        .filter(Boolean)
        .join('\n')
    );
  }

  if (typeof content === 'object') {
    if (typeof content.text === 'string') {
      return normalizeWhitespace(content.text);
    }

    if (typeof content.value === 'string') {
      return normalizeWhitespace(content.value);
    }

    if (typeof content.content === 'string') {
      return normalizeWhitespace(content.content);
    }

    return normalizeWhitespace(JSON.stringify(content, null, 2));
  }

  return normalizeWhitespace(String(content));
}

function inferRole(entry) {
  return entry.role || entry.author || entry.sender || entry.type || entry.kind || 'unknown';
}

function extractConversationEntryFromEventStream(parsed) {
  if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
    return null;
  }

  if (!parsed.type.endsWith('.message')) {
    return null;
  }

  const role = parsed.type.split('.')[0] || inferRole(parsed);
  const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : {};
  const rawContent =
    data.content ||
    data.message ||
    data.prompt ||
    data.response ||
    data.text ||
    data.value;
  const content = stringifyContent(rawContent);

  if (!content) {
    return null;
  }

  return {
    role,
    content,
  };
}

function findConversationArrays(node, pathHint = 'root', matches = []) {
  if (Array.isArray(node)) {
    const messageLikeItems = node.filter(
      (item) => item && typeof item === 'object' && (item.role || item.author || item.sender || item.content || item.text || item.message)
    );

    if (messageLikeItems.length > 0) {
      matches.push({ path: pathHint, entries: messageLikeItems });
    }

    node.forEach((item, index) => {
      findConversationArrays(item, `${pathHint}[${index}]`, matches);
    });

    return matches;
  }

  if (!node || typeof node !== 'object') {
    return matches;
  }

  Object.entries(node).forEach(([key, value]) => {
    findConversationArrays(value, `${pathHint}.${key}`, matches);
  });

  return matches;
}

function extractConversationFromJson(jsonData) {
  const matches = findConversationArrays(jsonData);

  if (matches.length === 0) {
    return { entries: [], source: 'json:no-conversation-array' };
  }

  const bestMatch = matches.sort((left, right) => right.entries.length - left.entries.length)[0];
  const entries = bestMatch.entries
    .map((entry) => {
      const rawContent = entry.message || entry.content || entry.text || entry.value || entry.parts;
      const content = stringifyContent(rawContent);

      if (!content) {
        return null;
      }

      return {
        role: inferRole(entry),
        content,
      };
    })
    .filter(Boolean);

  return {
    entries,
    source: `json:${bestMatch.path}`,
  };
}

function extractConversationFromJsonl(text) {
  const entries = [];
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  let sawEventStream = false;
  let sessionId = '';
  let sessionStart = '';

  lines.forEach((line) => {
    const parsed = safeParseJson(line);

    if (!parsed || typeof parsed !== 'object') {
      return;
    }

    if (parsed.type === 'session.start') {
      sawEventStream = true;

      if (parsed.data && typeof parsed.data === 'object') {
        sessionId = sessionId || parsed.data.sessionId || '';
        sessionStart = sessionStart || parsed.data.startTime || parsed.timestamp || '';
      }

      return;
    }

    const eventStreamEntry = extractConversationEntryFromEventStream(parsed);

    if (eventStreamEntry) {
      sawEventStream = true;
      entries.push(eventStreamEntry);
      return;
    }

    const candidateFields = [
      parsed.message,
      parsed.content,
      parsed.text,
      parsed.attrs && parsed.attrs.message,
      parsed.attrs && parsed.attrs.prompt,
      parsed.attrs && parsed.attrs.response,
    ];

    const content = stringifyContent(candidateFields.find(Boolean));
    const role = inferRole(parsed);

    if (content) {
      entries.push({ role, content });
    }
  });

  return {
    entries,
    source: sawEventStream ? 'jsonl:event-stream' : 'jsonl:line-scan',
    sessionId,
    sessionStart,
  };
}

function getWorkspaceStorageRoot() {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage');
    case 'win32':
      return path.join(process.env.APPDATA || '', 'Code', 'User', 'workspaceStorage');
    default:
      return path.join(os.homedir(), '.config', 'Code', 'User', 'workspaceStorage');
  }
}

function resolveTranscriptCandidates(hookInput) {
  const candidates = [];

  const transcriptPath = getHookValue(hookInput, 'transcriptPath', 'transcript_path');

  if (transcriptPath) {
    candidates.push(transcriptPath);
  }

  const sessionId = getHookValue(hookInput, 'sessionId', 'session_id');

  if (sessionId) {
    const workspaceStorageRoot = getWorkspaceStorageRoot();

    if (fs.existsSync(workspaceStorageRoot)) {
      const storageEntries = fs.readdirSync(workspaceStorageRoot, { withFileTypes: true });

      storageEntries
        .filter((entry) => entry.isDirectory())
        .forEach((entry) => {
          const debugLogDir = path.join(
            workspaceStorageRoot,
            entry.name,
            'GitHub.copilot-chat',
            'debug-logs',
            sessionId
          );

          candidates.push(path.join(debugLogDir, 'transcript.json'));
          candidates.push(path.join(debugLogDir, 'main.jsonl'));
        });
    }
  }

  return [...new Set(candidates)];
}

function loadConversation(hookInput) {
  const candidates = resolveTranscriptCandidates(hookInput);
  const diagnostics = [];

  for (const candidatePath of candidates) {
    if (!candidatePath || !fs.existsSync(candidatePath)) {
      continue;
    }

    try {
      const rawText = fs.readFileSync(candidatePath, 'utf8');
      const parsedJson = safeParseJson(rawText);
      const result = parsedJson
        ? extractConversationFromJson(parsedJson)
        : extractConversationFromJsonl(rawText);

      diagnostics.push(`Checked ${candidatePath} -> ${result.source} (${result.entries.length} entries)`);

      if (result.entries.length > 0) {
        return {
          entries: result.entries,
          sourcePath: candidatePath,
          sourceType: result.source,
          sessionId: result.sessionId || '',
          sessionStart: result.sessionStart || '',
          diagnostics,
          rawFallback: rawText,
        };
      }

      return {
        entries: [],
        sourcePath: candidatePath,
        sourceType: result.source,
        sessionId: result.sessionId || '',
        sessionStart: result.sessionStart || '',
        diagnostics,
        rawFallback: rawText,
      };
    } catch (error) {
      diagnostics.push(`Failed ${candidatePath}: ${error.message}`);
    }
  }

  return {
    entries: [],
    sourcePath: null,
    sourceType: 'none',
    sessionId: '',
    sessionStart: '',
    diagnostics,
    rawFallback: '',
  };
}

function renderConversation(entries) {
  if (entries.length === 0) {
    return [
      'No se pudo reconstruir una transcripcion completa con las fuentes disponibles.',
      '',
      'Se guardan igual los metadatos y cualquier contenido crudo recuperable para no perder la sesion.',
    ].join('\n');
  }

  return entries
    .map((entry, index) => {
      const role = String(entry.role || 'unknown').toUpperCase();
      return [`### ${index + 1}. ${role}`, '', entry.content].join('\n');
    })
    .join('\n\n');
}

function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n...\n[truncated]`;
}

function resolveWorkspaceDirectory(hookInput) {
  return getHookValue(hookInput, 'cwd') || process.cwd();
}

function resolveSessionId(hookInput, conversation) {
  return getHookValue(hookInput, 'sessionId', 'session_id') || conversation.sessionId || '';
}

function resolveSessionTimestamp(hookInput, conversation) {
  return conversation.sessionStart || getHookValue(hookInput, 'timestamp') || new Date().toISOString();
}

function findExistingHistoryFile(historyDir, sessionId) {
  if (!sessionId || !fs.existsSync(historyDir)) {
    return null;
  }

  const sessionSlug = slugifySessionId(sessionId);
  const matchingFile = fs
    .readdirSync(historyDir)
    .find((fileName) => fileName.endsWith(`_${sessionSlug}_chat.md`));

  return matchingFile ? path.join(historyDir, matchingFile) : null;
}

function resolveHistoryFilePath(hookInput, conversation) {
  const historyFolder = process.env.HISTORY_FOLDER || 'HISTORY';
  const cwd = resolveWorkspaceDirectory(hookInput);
  const historyDir = path.join(cwd, historyFolder);
  const sessionId = resolveSessionId(hookInput, conversation);
  const existingFilePath = findExistingHistoryFile(historyDir, sessionId);

  if (existingFilePath) {
    return existingFilePath;
  }

  const timestamp = formatTimestamp(resolveSessionTimestamp(hookInput, conversation));
  const fileName = `${timestamp.fileStamp}_${slugifySessionId(sessionId)}_chat.md`;
  return path.join(historyDir, fileName);
}

function buildMarkdown(hookInput, conversation, outputFilePath) {
  const includeDiagnostics = process.env.INCLUDE_DIAGNOSTICS !== 'false';
  const generatedAt = formatTimestamp(getHookValue(hookInput, 'timestamp'));
  const sessionId = resolveSessionId(hookInput, conversation);
  const hookEventName = getHookValue(hookInput, 'hookEventName', 'hook_event_name') || 'Stop';
  const metadataLines = [
    `- Generated: ${generatedAt.iso}`,
    `- Session Start: ${conversation.sessionStart || 'unknown'}`,
    `- Session ID: ${sessionId || 'unknown'}`,
    `- Hook Event: ${hookEventName}`,
    `- Workspace: ${resolveWorkspaceDirectory(hookInput) || 'unknown'}`,
    `- Output File: ${outputFilePath}`,
    `- Transcript Source: ${conversation.sourcePath || 'none'}`,
    `- Transcript Parse Mode: ${conversation.sourceType}`,
  ];

  const parts = [
    '# Chat History',
    '',
    ...metadataLines,
    '',
    '## Conversation',
    '',
    renderConversation(conversation.entries),
  ];

  if (includeDiagnostics && conversation.diagnostics.length > 0) {
    parts.push('', '## Diagnostics', '', conversation.diagnostics.join('\n'));
  }

  const rawPayload = truncate(JSON.stringify(hookInput, null, 2), 12000);
  if (includeDiagnostics && rawPayload) {
    parts.push('', '## Hook Payload', '', '```json', rawPayload, '```');
  }

  const rawTranscript = truncate(conversation.rawFallback, 20000);
  if (includeDiagnostics && rawTranscript) {
    parts.push('', '## Raw Transcript Fallback', '', '```', rawTranscript, '```');
  }

  parts.push('', '## Handoff', '', '- Decisions:', '- Next steps:', '- Open questions:');

  return parts.join('\n');
}

function writeHistoryFile(outputFilePath, markdown) {
  const historyDir = path.dirname(outputFilePath);

  ensureDirectory(historyDir);
  fs.writeFileSync(outputFilePath, markdown, 'utf8');

  return outputFilePath;
}

async function main() {
  const stdinText = await readStdin();
  const hookInput = safeParseJson(stdinText) || {};

  if (hookInput.stop_hook_active || hookInput.stopHookActive) {
    process.stdout.write(JSON.stringify({ continue: true }));
    return;
  }

  const conversation = loadConversation(hookInput);
  const outputFilePath = resolveHistoryFilePath(hookInput, conversation);
  const markdown = buildMarkdown(hookInput, conversation, outputFilePath);

  writeHistoryFile(outputFilePath, markdown);

  process.stdout.write(
    JSON.stringify({
      continue: true,
      systemMessage: `Chat history exported to ${outputFilePath}`,
    })
  );
}

main().catch((error) => {
  process.stderr.write(`export-chat-history failed: ${error.message}\n`);
  process.stdout.write(
    JSON.stringify({
      continue: true,
      systemMessage: `Chat history export failed: ${error.message}`,
    })
  );
  process.exitCode = 0;
});