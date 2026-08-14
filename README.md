# DSH Model Compatibility Plugin

This plugin provides model-specific compatibility fixes for DeepSeek Harness.

## Features

### Fix GPT `pwsh` and `edit` tool-call failures

When the selected model id matches `^gpt(?:-|$)`, the plugin removes two
escalation properties from the GPT-visible `pwsh` and `edit` tool schemas:

- `sandbox_permissions`
- `justification`

GPT Responses models may eagerly populate every optional property. In DSH
`0.1.0-rc.6`, that behavior can produce either of these errors before
the tool starts:

```text
invalid justification: expected a non-empty sentence
sandbox escalation to "danger-full-access" is not strictly wider than this call's current "danger-full-access" mode
```

Other model families, other tools, and the `pwsh` / `edit` executors remain
unchanged by this fix.

### Retry transient DeepSeek upstream errors

When the selected model id matches `^deepseek(?:-|$)`, the plugin handles these
upstream HTTP failures before DSH's generic retry policy:

- `503`: the upstream system is under CPU overload; wait 10 seconds, then send
  the request again.
- `429`: the upstream request limit has been reached; wait 30 seconds, then send
  the request again.

Each wait is cancelled immediately if the active turn is aborted. Other HTTP
statuses and non-DeepSeek models continue through DSH's normal error handling.

## Install

Run these commands in PowerShell 7:

```powershell
Set-Location E:\Github\dsh-wanglele
dsh plugin --profile headless add .
dsh plugin --profile web add .
```

The package declares a DSH bundle patch, so installation also adds it to the
selected profile's `dsh.profile.bundles` list.

## Verify

```powershell
npm test
dsh --profile headless --dump-config | Select-String 'gpt-pwsh-compat'
dsh --profile web --dump-config | Select-String 'gpt-pwsh-compat'
```

## Implementation

For GPT, the plugin participates in the authoritative
`system-prompt/assemble` waterfall. It waits for downstream model selection,
reads `assembled.variables.model`, and clones only the GPT-visible `pwsh` and
`edit`
schema. The original tool registration and execution callbacks remain intact.

For DeepSeek, the plugin prepends a global `agent/request-error` waterfall
listener. Matching `503` and `429` failures use abort-aware fixed delays and
return `{ kind: "retry" }`, causing the agent loop to resend the same model
request.

## Compatibility

- DeepSeek Harness: `0.1.0-rc.6`
- Node.js: `20` or newer
- Platform: any DSH host

## License

MIT
