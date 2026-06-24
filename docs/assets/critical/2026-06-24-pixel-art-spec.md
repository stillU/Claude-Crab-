# 像素美术规格

## 形象

Claude 小螃蟹（参考 `形象.png`），像素风格。

## 画布规格

- **帧尺寸**：64×64 px
- **色深**：索引色或有限调色板（16-32 色，保持像素风格纯粹感）
- **背景**：透明（PNG alpha）
- **缩放**：运行时整数倍放大（×2 = 128px，×3 = 192px），无抗锯齿（`image-rendering: pixelated`）

## 各状态帧清单

| 文件 | 状态 | 帧数 | 描述 |
|---|---|---|---|
| `idle/walk.png` | IDLE 走动 | 8 | 螃蟹侧身走路，帧间配合位移 |
| `idle/idle.png` | IDLE 发呆 | 2 | 轻度呼吸/眨眼变化 |
| `idle/poke.png` | 戳反应 | 2 | 被双击时的弹跳反应 |
| `working/coding.png` | WORKING 敲代码 | 6 | 螃蟹面对笔记本，蟹钳敲键盘 |
| `working/sweat.png` | WORKING 擦汗 | 3 | 用蟹钳擦汗 |
| `complete/phone.png` | COMPLETE 玩手机 | 4 | 螃蟹躺着/坐着玩手机 |
| `error/panic.png` | ERROR 冒汗 | 2 | 螃蟹紧张冒汗 |
| `error/cloud.png` | 思考云 | 1 | 独立云朵图层，红色 ERROR 文字 |
| `sleep/sleep.png` | SLEEP 睡觉 | 4 | 螃蟹闭眼睡眠，呼吸起伏 |

## 方向

- 螃蟹默认朝向左或右（以形象.png 为准）
- 走动时可通过镜像翻转（Canvas `scale(-1, 1)`）实现转向，无需为左右各绘制一套帧

## 输出格式

- 每个 spritesheet 为单张 PNG，水平等距排列各帧
- 约定总宽度 = 帧宽 × 帧数（如 walk.png 为 512×64 px）
- Canvas 通过 drawImage 的 `sx` 偏移逐帧截取渲染
