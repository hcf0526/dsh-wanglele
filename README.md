# @wanglele/dsh-wanglele

DSH 模型兼容性与自定义系统提示词增强插件（DeepSeek Harness Plugin）。

## 功能特性 (Features)

### 1. ⚙️ 自定义系统提示词（Wanglele 设置面板，支持热加载）
- **官方设置面板集成**：在 DSH 设置（Settings）中添加 **「Wanglele」** 分区。
- **自定义系统提示词注入**：支持开启/关闭自定义系统提示词，为 AI Agent 注入专属角色、工作规范或个性设定。
- **支持 3 种注入模式**：
  - **追加到末尾 (Append - 推荐)**：保留 DSH 原生工具提示词与框架指引，在末尾附加上下文。
  - **置于开头 (Prepend)**：置于最前列，增强优先级。
  - **完全替换 (Replace)**：仅使用你输入的自定义提示词。
- **⚡ 热加载即时生效 (Hot-Reloading)**：通过 DSH 动态设置响应系统，保存后**无需重启 DSH、无需刷新页面**，下一次模型对话轮次立即生效。
- **自适应高输入框与高度记忆**：
  - 默认采用舒适的高输入框（`280px+`，支持垂直自由拖拽缩放）。
  - **自动持久化记忆高度**：手动拖动调节的高度会自动存储，下次打开保持你的偏好。
  - 提供「清空」、「填入推荐模板」、「重置高度」等快捷操作与实时字数/行数统计。

### 2. 🛠️ GPT / Gemini 工具调用 Schema 兼容补丁
- 识别 `gpt-*` 与 `gemini-3.*-flash` 等大模型。
- 自动剔除 `pwsh` 与 `edit` 工具中容易触发第三方中转站/网关校验报错的 `sandbox_permissions` 与 `justification` 递归嵌套字段，防止 400 校验异常。

### 3. 🔄 Gemini 3 Flash 流式工具调用自动恢复
- 自动捕获部分中转网关在 Gemini 3 Flash 下缺失 `arguments` 导致的 `startsWith` 流解析异常。
- 自动拼接已接收的参数切片并优雅补全闭合 tool-call 块，避免任务中断。

---

## 安装 (Install)

在 PowerShell 中执行：

```powershell
Set-Location E:\Github\dsh-wanglele
dsh plugin --profile headless add .
dsh plugin --profile web add .
```

---

## 验证与测试 (Test & Verify)

```powershell
npm test
```

---

## 版本日志 (Changelog)

详见 [CHANGELOG.md](./CHANGELOG.md)。

## License

MIT
