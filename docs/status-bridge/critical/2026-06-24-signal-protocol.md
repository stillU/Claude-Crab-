# 信号协议

status-bridge 通过 Claude Code 的 hook 机制感知工作状态变化。

## 信号格式

```json
{
  "status": "working" | "complete" | "error",
  "timestamp": "2026-06-24T14:30:00Z",
  "message": "可选：错误描述等附加信息"
}
```

## 主通道：文件写入

- **写入路径**：`~/.claude/status-bridge/state.json`
- **写入方**：Claude Code hook 脚本
- **读取方**：status-bridge 的 signal-listener（文件监听）
- **监听方式**：使用 Rust `notify` crate 监听文件变更（`notify::EventKind::Modify`）
- **防抖**：200ms 内重复变更视为同一次

## 扩展通道：本地 HTTP（预留）

- 螃蟹内部启动 localhost HTTP 服务（端口 19876）
- 端点：`POST /signal`，接收与文件相同的 JSON 格式
- 用途：未来外部工具或脚本可直接 HTTP 推送状态
- 当前阶段仅搭建框架，不实现具体逻辑

## Hook 配置示例

在 Claude Code 的 `settings.json` 中配置 hook：

```json
{
  "hooks": {
    "beforeToolUse": [
      {
        "matcher": "",
        "command": "echo '{\"status\":\"working\",\"timestamp\":\"'$(date -Iseconds)'\"}' > ~/.claude/status-bridge/state.json"
      }
    ],
    "afterToolUse": [
      {
        "matcher": "",
        "command": "echo '{\"status\":\"complete\",\"timestamp\":\"'$(date -Iseconds)'\"}' > ~/.claude/status-bridge/state.json"
      }
    ],
    "onError": [
      {
        "command": "echo '{\"status\":\"error\",\"timestamp\":\"'$(date -Iseconds)'\",\"message\":\"Claude Code error\"}' > ~/.claude/status-bridge/state.json"
      }
    ]
  }
}
```
