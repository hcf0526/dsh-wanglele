# DSH GPT pwsh Compatibility Plugin

This plugin removes two optional escalation properties from the `pwsh` tool
schema when the selected model id matches `^gpt(?:-|$)`:

- `sandbox_permissions`
- `justification`

The patch addresses GPT Responses tool calls that eagerly populate every
optional property. In DSH `0.1.0-rc.6`, that behavior can produce either of
these errors before PowerShell starts:

```text
invalid justification: expected a non-empty sentence
sandbox escalation to "danger-full-access" is not strictly wider than this call's current "danger-full-access" mode
```

DeepSeek, Claude, other model families, other tools, and the `pwsh` executor
are left unchanged.

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

The plugin participates in the authoritative `system-prompt/assemble`
waterfall. It waits for downstream model selection, reads
`assembled.variables.model`, and clones only the GPT-visible `pwsh` schema.
The original tool registration and execution callbacks remain intact.

## Compatibility

- DeepSeek Harness: `0.1.0-rc.6`
- Node.js: `20` or newer
- Platform: any DSH host; the affected tool is Windows PowerShell

## License

MIT
