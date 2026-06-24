# CLAUDE.md

## 项目目标

构建一个 Windows 桌面桌宠——像素风格的 Claude 小螃蟹，通过在桌面上的行为表现来反映 Claude Code 的工作状态。技术栈：Tauri（Rust + Web 前端）。

## 事件边界（工作约束）

编写本项目代码时必须遵守以下规则：

- **分支隔离**：每个模块独立 Git 分支，禁止所有模块在同一分支开发
- **子代理构建**：使用子代理（Agent）实现模块，不直接在对话中编写所有代码
- **三次上限**：某步骤连续失败 3 次立即停止，向用户求助
- **先思后行**：每次操作前检查与现有代码的关联性、是否符合当前环境
- **复用优先**：存在可复用模块时，复制到 `code/reusable/`，其他模块从中引用，不重复编写

## 成品要求

- Windows 桌面运行，透明无边框窗口，始终置顶
- 像素帧动画 spritesheet，Claude 小螃蟹形象（参考 `形象.png`）
- 鼠标可拖拽；系统托盘常驻，右键菜单可退出
- 信号驱动感知 Claude Code 状态（文件监听为主，进程检测兜底）
- 预留扩展接口，不实现额外功能

## 文档索引

### 螃蟹行为与状态
- `docs/state-machine/critical/2026-06-24-state-transitions.md` — 状态定义与转移规则
- `docs/animation/critical/2026-06-24-pixel-frame-spec.md` — 像素帧规格与动画参数
- `docs/behavior/critical/2026-06-24-behavior-queue.md` — 行为调度与优先级
- `docs/behavior/important/2026-06-24-idle-behavior-pool.md` — 空闲行为池
- `docs/interaction/important/2026-06-24-mouse-interaction.md` — 鼠标交互
- `docs/interaction/important/2026-06-24-tray-menu.md` — 系统托盘菜单
- `docs/assets/critical/2026-06-24-pixel-art-spec.md` — 美术资源规格

### 技术架构
- `docs/status-bridge/critical/2026-06-24-signal-protocol.md` — 信号协议（hook → 文件 → 监听）
- `docs/status-bridge/important/2026-06-24-fallback-detection.md` — 进程检测兜底
- `docs/pet-window/important/2026-06-24-overlay-window.md` — 桌面窗口系统

### 项目结构
- `docs/project-structure.md` — 完整目录结构

### 代码位置
- `code/desktop-pet/` — 桌宠本体
- `code/status-bridge/` — 状态感知层
- `code/reusable/` — 可复用模块
