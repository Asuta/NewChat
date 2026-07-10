# 延迟结算世界时间 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让世界时间在查询时间和切换场景时，根据检查点之后的剧情统一结算，并防止重复计时。

**Architecture:** 在现有 SQLite `meta` 中保存时间检查点和 conversation 游标，以 `conversations` 作为未结算剧情账本。Agent 每轮获得动态时间上下文，通过 `update_time` 或增强后的 `transition_scene` 提交分项，后端验证并原子落库。

**Tech Stack:** Node.js、`node:sqlite`、Express、React、TypeScript、Node test runner。

## Global Constraints

- 初始时间为第 1 日 12:00。
- 时间只在查询时间和切换场景时结算。
- 明确绝对时间优先于明确持续时间，明确持续时间优先于行为估算。
- 已结算剧情不得重复计时。
- 不新增数据库表，旧存档必须兼容。

---

### Task 1: 时间检查点与未结算剧情

**Files:**
- Modify: `server/worldDb.js`
- Test: `server/worldTime.test.js`

**Interfaces:**
- Produces: `getWorldTimeContext()`、`updateWorldTime(options)`，以及带 checkpoint/pendingEventCount 的 `getWorldTimeState()`。

- [ ] 写失败测试：初始检查点为 12:00，新增 conversation 后能读取未结算剧情。
- [ ] 写失败测试：结算 480 分钟后游标推进，再次读取不返回已结算剧情。
- [ ] 实现检查点懒初始化、conversation 游标查询、分项校验与原子结算。
- [ ] 运行 `pnpm test`，确认检查点与防重复用例通过。

### Task 2: Agent 查询时间结算

**Files:**
- Modify: `server/worldAgent.js`
- Modify: `context/020-world-agent-tools.md`
- Modify: `context/030-world-agent-rules.md`
- Modify: `context/040-world-agent-output-format.md`
- Test: `server/worldTime.test.js`

**Interfaces:**
- Consumes: `getWorldTimeContext()`、`updateWorldTime(options)`。
- Produces: `update_time` 原生工具；每轮动态时间系统消息。

- [ ] 写失败测试：`get_time_state` 返回未结算剧情，`update_time` 提交分项后返回新时间。
- [ ] 将动态时间上下文注入 `createInitialPlanningMessages()`。
- [ ] 添加 `update_time` schema、白名单、执行逻辑与工具步骤摘要。
- [ ] 更新规则：询问时间必须先读取、再结算、最后发言。
- [ ] 运行 `pnpm test`。

### Task 3: 场景切换分项结算

**Files:**
- Modify: `server/worldDb.js`
- Modify: `server/worldAgent.js`
- Modify: `src/App.tsx`
- Test: `server/worldTime.test.js`

**Interfaces:**
- `transition_scene` consumes: `sceneTimeSegments`, `travelMinutes`, `travelReason`, `throughConversationId`, `previousSceneSummary`。

- [ ] 写失败测试：12:00 查询结算到 20:00 后，新增剧情 10 分钟加赶路 25 分钟，切场景得到 20:35。
- [ ] 修改 `transitionScene()`，分开记录场景剧情耗时和赶路耗时，并更新检查点游标。
- [ ] 修改 Agent schema 和前端切场景提示，强制提交分项与游标。
- [ ] 验证非法游标、负数分项、超限耗时和非法出口均不写库。
- [ ] 运行 `pnpm test`。

### Task 4: 类型、展示与完整验证

**Files:**
- Modify: `src/types.ts`
- Modify: `src/components/WorldPanel.tsx`
- Modify: `src/components/AgentStepsTimelineItem.tsx`
- Modify: `README.md`

**Interfaces:**
- `WorldTimeState` exposes checkpoint and pendingEventCount without把完整剧情账本发送给普通 UI。

- [ ] 更新前端类型和工具名称显示。
- [ ] 在世界时间区域显示待结算剧情数量。
- [ ] 运行 `pnpm test`、`pnpm build`、`git diff --check`。
- [ ] 使用 `pnpm dev` 和 Codex 内置浏览器验证宽屏游戏视图、时间显示和控制台。
- [ ] 对最终差异执行代码审查，修复所有 Critical/Important 发现。
