# AI History Export

Automatically exports AI chat sessions into a `HISTORY/` folder as Markdown files. Supports Claude Code (automatic) and GitHub Copilot (manual).

## How it works

When an AI chat session ends, the extension triggers a bundled script that reads the transcript and writes a Markdown file to `HISTORY/` in your workspace. Each session gets its own file, updated on re-run.

## Supported Providers

| Provider | Mode | How |
|---|---|---|
| Claude Code | Automatic | Installs a `Stop` hook in `.claude/settings.json` |
| GitHub Copilot | Manual | Run "AI History Export: Save current Copilot chat" |

## Commands

| Command | Description |
|---|---|
| `AI History Export: Enable for Workspace` | Install hook and create HISTORY/ |
| `AI History Export: Disable for Workspace` | Remove hook (HISTORY/ is preserved) |
| `AI History Export: Open HISTORY Folder` | Open the export folder |
| `AI History Export: Repair Configuration` | Re-apply hook with current settings |
| `AI History Export: Validate Installation` | Check Node.js, script, and hook status |

## Settings

| Setting | Default | Description |
|---|---|---|
| `aiHistoryExport.provider` | `auto` | AI provider (`auto`, `claude-code`, `copilot`) |
| `aiHistoryExport.hookScope` | `project` | Hook target: `project` or `user` level |
| `aiHistoryExport.historyFolderName` | `HISTORY` | Export folder name |
| `aiHistoryExport.includeDiagnostics` | `true` | Include diagnostics sections in exports |
| `aiHistoryExport.overwriteSessionFile` | `true` | Update existing file for same session |

## Requirements

- Node.js 18+ on PATH (used to run the exporter script)
- Claude Code or GitHub Copilot installed

## Privacy

All exports are local files only. No data is sent to any remote service.
