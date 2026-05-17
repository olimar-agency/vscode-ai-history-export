# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 0.1.x | ✅ |

## Data Handling

This extension operates entirely locally. It does not transmit any data to external services.

- Chat transcripts are read from local disk paths provided by the AI provider's hook payload.
- Exported Markdown files are written to the workspace `HISTORY/` folder only.
- Hook configuration is written to the AI provider's local settings file (e.g. `.claude/settings.json`).
- No telemetry, analytics, or remote logging in v1.

## Reporting a Vulnerability

To report a security vulnerability, please open a GitHub issue with the label `security` or contact the maintainers directly via the repository.

Do not include sensitive transcript content in public issue reports.
