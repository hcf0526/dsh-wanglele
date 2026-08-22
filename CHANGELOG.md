# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2026-08-22

### Added
- **设置面板新增「Wanglele」专属分区与自定义系统提示词功能**：
  - 注册 `settings.section`（id: `wanglele`），在 Web 界面官方设置面板中提供可视化管理界面。
  - **自定义系统提示词 / 会话上下文注入 (Context Injection)**：
    - 前端设置项保持「系统提示词」名称，底层采用标准 `agent/pre-step` 上下文注入机制。
    - 前端对话流中直观展示 **「📄 上下文注入 · wanglele」** 折叠卡片，可点击展开查看当前生效的提示词文本。
    - **热加载 (Hot-Reloading)**：修改或保存后**无需重启或刷新**，下一次对话立即生效。
  - **3 种提示词注入位置模式**：
    - `append`（默认推荐：追加到原生提示词末尾，兼顾工具规范与个性设定）
    - `prepend`（置于最开头，提高指令优先级）
    - `replace`（完全替换全部提示词）
  - **自适应高输入框与高度记忆**：
    - 默认高度提升至 `280px`（支持垂直自由拉伸 `160px ~ 1200px`）。
    - 自动持久化记忆用户调整的输入框高度（通过 `localStorage` 与 Host settings 双重持久化）。
    - 支持「填入推荐模板」、「清空」、「重置高度」及实时字数与行数统计。
  - **可视化兼容性开关**：
    - 提供「启用 GPT 工具 Schema 兼容补丁」与「启用 Gemini 3 Flash 工具流恢复」的开关控制。

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
