# 项目结构

```
毕设/
├── CLAUDE.md                               # 项目目标 + 事件边界 + 成品要求
│
├── .gitignore
│
├── code/
│   ├── desktop-pet/                        # 桌宠本体 (Tauri)
│   │   └── src/
│   │       ├── main.ts                     # 入口
│   │       ├── pet-window.ts               # 透明无边框窗口管理
│   │       ├── state-machine.ts            # 状态机
│   │       ├── animation.ts                # 像素帧动画播放器
│   │       ├── behavior.ts                 # 行为调度
│   │       ├── interaction.ts              # 鼠标交互 + 预留接口
│   │       └── assets/
│   │           ├── idle/
│   │           ├── working/
│   │           ├── complete/
│   │           ├── error/
│   │           └── sleep/
│   │
│   ├── status-bridge/                      # 状态感知层 (Rust)
│   │   └── src/
│   │       ├── signal-listener.ts          # 文件监听
│   │       ├── process-detector.ts         # 进程检测兜底
│   │       └── bridge.ts                   # 统一接口
│   │
│   └── reusable/                           # 可复用模块
│
└── docs/                                   # 文档（模块→重要程度→日期）
    ├── project-structure.md
    ├── state-machine/
    ├── animation/
    ├── behavior/
    ├── interaction/
    ├── status-bridge/
    ├── pet-window/
    └── assets/
```
