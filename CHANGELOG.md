# Changelog

## [0.1.1] - 2026-05-18

### Added
- Extension icon (512×512)

## [0.1.0] - 2026-05-18

### Added
- Initial release
- Claude Code provider: merges Stop hook into `.claude/settings.json`
- GitHub Copilot provider: manual export command
- Commands: Enable, Disable, Open HISTORY Folder, Repair Configuration, Validate Installation
- Settings: provider, hookScope, historyFolderName, includeDiagnostics, overwriteSessionFile
- Cross-platform transcript fallback path resolution (macOS, Linux, Windows)
- Env var bridge from VS Code settings to exporter script (HISTORY_FOLDER, INCLUDE_DIAGNOSTICS)
- CI pipeline with matrix builds on macOS, Linux, Windows × Node 18, 20
- Release pipeline publishing to VS Code Marketplace and Open VSX
