# 大模型任务判定

NewChat 的剧情任务不依赖固定数值或针对剧情写死的 `if/else`。每个玩家回合完成后，后端会把全部活动任务、这些任务此前的进度摘要，以及自上次成功判定以来新增的对话和世界事件，一次性交给独立的大模型裁定。

## 回合流程

1. 世界 Agent 正常处理玩家输入、工具调用和 NPC 发言。
2. `server/questJudge.js` 读取任务判定游标之后的新对话与新事件。
3. 所有 `judgeEnabled: true` 且 `status: active` 的任务在一次模型请求中判定。
4. 模型必须通过 `submit_quest_judgment` 工具为每条候选任务返回：
   - `unchanged`：没有真实新进展；
   - `progressed`：有进展但尚未满足全部标准；
   - `completed`：已经满足全部完成标准；
   - `failed`：已经永久无法完成。
5. 后端只校验任务 ID、结果结构和证据 ID 是否真实存在，不用剧情关键词或硬编码条件替代模型判断。
6. 校验通过后，任务组件、关联的主线目标、进度摘要、任务事件、后续任务解锁和证据游标在同一事务中写入。

一次请求会判定全部活动任务，不是每条任务各请求一次模型。没有新证据时不会调用模型。判定请求失败时不影响本轮游戏回复，也不会推进证据游标，因此后续回合可以带着同一批证据重试。

## 任务数据

需要自动判定的任务在 `quest` 组件中使用以下字段：

```json
{
  "status": "active",
  "phaseStatus": "available",
  "title": "寻找范德彪",
  "description": "玩家看到的任务介绍。",
  "judgeEnabled": true,
  "questLogVisible": true,
  "displayOrder": 2,
  "completionCriteria": "用自然语言写明真正完成和不能算完成的边界。",
  "progressSummary": "只记录已经发生的事实，供下一回合接续判断。",
  "onComplete": {
    "activateQuestIds": ["quest_find_xiaocui"]
  }
}
```

`completionCriteria` 应描述可观察的剧情结果，同时明确常见的“还不算完成”情况。不要在代码中为某一条剧情任务增加关键词、场景 ID 或数值判断。

汇总任务可以在 `objectives` 中用 `questId` 关联子任务：

```json
{
  "objectives": [
    {
      "questId": "quest_find_debiao",
      "text": "找到范德彪并恢复与家人的联系",
      "status": "active"
    }
  ]
}
```

关联子任务发生进展、完成或失败时，该目标会同步为 `active`、`completed` 或 `failed`；后续任务被解锁时，对应目标会同步为 `active`。同步逻辑只读取这份数据关联，不包含具体任务的专属分支。内置马大帅旧存档启动时会补齐缺失的关联，并按照现有子任务状态校正主线目标。

当前 MVP 启用了三条任务：

- 身无分文在城里活下来；
- 寻找范德彪，完成后解锁“父女见面”；
- 父女见面，完成后解锁“退婚与三万元彩礼”。

后续任务可以继续沿用同一数据结构启用，无需修改判定流程。

## 存档与接口

- `questJudge.conversationCursor` 和 `questJudge.eventCursor` 记录已经成功裁定到的证据位置。
- 新建预制世界从初始化事件之后开始记录。
- 老存档首次启用此功能时，从当前历史末尾开始记录，避免把旧聊天重新判成刚发生的任务进展。
- `GET /api/world` 的 `quests` 字段以及 `GET /api/world/quests` 都返回玩家任务日志。
- 游戏舞台的“任务”页签展示当前进度；新的 `quest.progressed`、`quest.completed`、`quest.failed` 或 `quest.activated` 事件会触发更新提示。

任务判定默认使用当前世界 Agent 模型。可以通过 `QUEST_JUDGE_MODEL` 单独指定模型；DeepSeek 模型在这个强制工具调用中会关闭 thinking 模式。
