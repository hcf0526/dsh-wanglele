# DSH Model Compatibility Plugin

This plugin provides model-specific compatibility fixes for DeepSeek Harness.

## Features

### Fix GPT and Gemini 3 Flash tool-call failures

When the selected model id matches `^gpt` or a Gemini 3 Flash model id such as
`gemini-3.7-flash`, the plugin removes two escalation properties from the
model-visible `pwsh` and `edit` tool schemas:

- `sandbox_permissions`
- `justification`

Some OpenAI Responses-compatible model routes eagerly populate every optional
property. In DSH `0.1.0-rc.6`, that can produce either of these errors before
the tool starts:

```text
invalid justification: expected a non-empty sentence
sandbox escalation to "danger-full-access" is not strictly wider than this call's current "danger-full-access" mode
```

### Recover malformed Gemini tool streams

Some Gemini 3 Flash routes behind an OpenAI Responses-compatible gateway emit a
`response.function_call_arguments.done` event without its required `arguments`
string. The installed `pi-ai` parser then fails with:

```text
Cannot read properties of undefined (reading 'startsWith')
```

The plugin wraps the DSH `llm/stream` waterfall for Gemini 3 Flash, preserves
the tool-call argument deltas already received, closes the incomplete tool call,
and converts the malformed error finish into a normal tool-call finish. Other
models, stream failures, and incomplete calls without a tool name continue
through normal error handling.

Other model families and tool executors remain unchanged by these fixes.

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

For GPT and Gemini 3 Flash, the plugin participates in the authoritative
`system-prompt/assemble` waterfall. It waits for downstream model selection,
reads `assembled.variables.model`, and clones only the model-visible `pwsh` and
`edit` schema. The original tool registration and execution callbacks remain
intact.

For Gemini 3 Flash, the plugin also wraps the global `llm/stream` waterfall. It
tracks open tool calls and their argument deltas. If the known pi-ai
`startsWith` failure arrives before the tool-call block closes, it emits the
missing block end and a `{ kind: "tool-calls" }` finish so the normal DSH tool
scheduler can execute the call.

## Compatibility

- DeepSeek Harness: `0.1.0-rc.6`
- Node.js: `20` or newer
- Platform: any DSH host

## License

MIT
