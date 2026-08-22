# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - 2026-08-15

### Added
- **Gemini 3 Flash 兼容支持**：
  - 自动拦截并移除 Gemini 3 Flash 模型下的 `pwsh` 和 `edit` 工具 schema 中的 `sandbox_permissions` 与 `justification` 属性，避免 OpenAI 兼容网关 eager 填充非法默认值。
  - 新增 `llm/stream` waterfall 拦截恢复机制：解决部分 OpenAI Responses 兼容网关下 Gemini 3 Flash 响应 `response.function_call_arguments.done` 时未返回 `arguments` 导致的 `Cannot read properties of undefined (reading 'startsWith')` 报错，自动还原并闭合工具调用参数块。

## [0.1.2] - 2026-08-14

### Added
- **GPT `edit` 工具调用兼容**：
  - 扩展 `system-prompt/assemble` 拦截器，在 GPT 模型下同步清理 `edit` 工具中的 `sandbox_permissions` 与 `justification` 参数。

## [0.1.1] - 2026-08-14

### Added
- **DeepSeek 模型延迟重试**：
  - 新增 `agent/request-error` 拦截器，捕获 DeepSeek 系列模型的 HTTP 503（等待 10s）与 HTTP 429（等待 30s）并自动执行延迟重试。

## [0.1.0] - 2026-08-14

### Added
- **初始版本发布**：
  - 修复 GPT 系列模型调用 `pwsh` 工具时的 schema 参数兼容性问题（剥离 `sandbox_permissions` 与 `justification`）。
