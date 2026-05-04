# AI diagnostics safety model

Zervox may add optional AI diagnostics later, but it must stay review-before-run by default.

## Rules

1. AI diagnostics are opt-in only.
2. Logs are summarized before being sent to a provider.
3. Secrets are redacted before any provider call.
4. AI may suggest shell commands, dependency changes, or file edits, but Zervox must not execute them automatically.
5. Every suggested fix is shown as a patch or command with an explicit confirmation step.
6. `AUTO_FIX` style execution is intentionally out of scope until there is a sandbox and policy engine.

## Suggested command shape

```bash
zervox diagnose <name> --provider gemini
zervox diagnose <name> --local
```

Output should include:

- probable root cause
- confidence level
- relevant log lines
- suggested commands or patches
- risk level for each suggestion

## Secret redaction targets

- API keys and bearer tokens
- `.env` style values
- database URLs
- private keys
- cookies
- authorization headers
