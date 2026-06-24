# 动画系统 — 像素帧规格与播放参数

## Spritesheet 规格

- **帧尺寸**：单个螃蟹像素帧 64×64 px
- **排列方式**：水平一行，等距排列，PNG alpha 透明背景
- **绘制缩放**：显示时支持整数倍放大（×2 或 ×3）

## 各状态帧表

| 状态 | 帧数 | 帧率 (fps) | 循环 | 备注 |
|---|---|---|---|---|
| IDLE 走动 | 8 | 8 | 是 | 配合水平位移形成走动效果 |
| IDLE 发呆 | 2 | 2 | 是 | 偶尔眨眼/轻微晃动 |
| WORKING 敲代码 | 6 | 12 | 是 | 螃蟹敲击笔记本电脑键盘 |
| WORKING 擦汗 | 3 | 6 | 单次 | 随机插入，播放后回到敲代码循环 |
| COMPLETE 玩手机 | 4 | 6 | 是 | 滑动手机屏幕 |
| ERROR 冒汗 | 2 | 4 | 是 | 思考云持续显示在头顶 |
| SLEEP 睡觉 | 4 | 4 | 是 | 缓慢呼吸起伏 |
| 双击戳反应 | 2 | 10 | 单次 | IDLE 态双击触发，播放后恢复 |

## 文件对应

```
code/desktop-pet/src/assets/
├── idle/
│   ├── walk.png      # 8帧 走动循环
│   ├── idle.png      # 2帧 发呆循环
│   └── poke.png      # 2帧 戳反应
├── working/
│   ├── coding.png    # 6帧 敲代码循环
│   └── sweat.png     # 3帧 擦汗
├── complete/
│   └── phone.png     # 4帧 玩手机循环
├── error/
│   ├── panic.png     # 2帧 冒汗
│   └── cloud.png     # 思考云（独立图层）
└── sleep/
    └── sleep.png     # 4帧 睡觉呼吸循环
```

## 播放规则

- 状态切换时，当前帧播放完毕后切换（最大延迟 200ms）
- WORKING 主循环播放中，每 8-15 秒随机插入一次擦汗
- COMPLETE 气泡文本与动画并排渲染
- ERROR 思考云使用独立图层，渲染于螃蟹头顶上方
- Canvas 渲染，requestAnimationFrame 驱动帧时钟
