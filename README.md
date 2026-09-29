# @wanglele/dsh-wanglele

DeepSeek Harness 自动重试与自定义系统提示词插件，适配 DSH `0.2.0-rc.2`。

## 当前功能

### 自定义系统提示词

- 在 Wanglele 设置分区启用并编辑提示词。
- 保存后在每次系统提示词组装时生效，可选择追加到末尾、置于开头或仅使用自定义提示词。

### 对话失败自动重试

- 对话失败后按设置延时发送“继续”。
- 成功结束的对话不会触发重试。
- 可设置最大连续完全失败次数。
- GPT/Gemini 兼容补丁与流式恢复功能目前关闭。

## 安装

在 PowerShell 中执行：

```powershell
Set-Location E:\Github\dsh-wanglele
dsh plugin --profile headless add .
dsh plugin --profile web add .
```

## 验证

```powershell
npm run check
npm test
```

## 版本日志

详见 [CHANGELOG.md](./CHANGELOG.md)。

## License

MIT
