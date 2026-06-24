# 状态机 — 状态定义与转移规则

## 状态定义

### IDLE（空闲）
- 触发条件：Claude Code 未运行或等待用户输入
- 允许行为：自由走动、发呆、边界反弹、随机小动作
- 子状态：5 分钟无活动 → SLEEP

### WORKING（工作中）
- 触发条件：收到"开始工作"信号
- 允许行为：敲键盘动画、专注表情、每 8-15 秒随机插入擦汗动作
- 约束：固定在桌面角落（右下角），不自由走动

### COMPLETE（任务完成）
- 触发条件：收到"工作完成"信号
- 允许行为：玩手机动画 + 气泡提示"任务完成"
- 3 分钟后自动回到 IDLE
- 可被新 WORKING 信号打断

### ERROR（报错）
- 触发条件：收到"错误"信号
- 允许行为：头顶出现思考云，云中红色像素字体显示"ERROR"
- 用户点击螃蟹关闭错误 → 回到 IDLE
- 收到 WORKING 信号 → 进入 WORKING

### SLEEP（睡觉，IDLE 子状态）
- 触发条件：IDLE 态 5 分钟无任何活动
- 允许行为：睡觉呼吸循环动画
- 收到任意信号 → 唤醒回到 IDLE

## 转移矩阵

| 当前状态 | 触发事件 | 目标状态 |
|---|---|---|
| IDLE | 收到 WORKING 信号 | WORKING |
| IDLE | 收到 ERROR 信号 | ERROR |
| IDLE | 5分钟无活动 | SLEEP |
| SLEEP | 收到任意信号 | IDLE |
| WORKING | 收到 COMPLETE 信号 | COMPLETE |
| WORKING | 收到 ERROR 信号 | ERROR |
| WORKING | 信号超时/进程消失 | IDLE |
| COMPLETE | 3分钟超时 | IDLE |
| COMPLETE | 收到 WORKING 信号 | WORKING |
| ERROR | 收到 WORKING 信号 | WORKING |
| ERROR | 用户点击关闭 | IDLE |

## 非法转移

以下转移被视为无效，状态机应忽略：
- IDLE/SLEEP 下收到 COMPLETE 信号（无意义）
- COMPLETE 下收到 COMPLETE 或 ERROR 信号
- 同一状态的重复信号
