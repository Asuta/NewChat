# NewChat

一个本地游戏聊天项目：React + Vite 前端，Express 后端，支持 OpenAI 兼容的大模型接口，并通过 SQLite 世界数据库 + Agent Loop 读取和修改游戏世界。

## 启动

```bash
pnpm install
pnpm dev
```

开发服务会启动：

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:8787`

如果默认端口被占用，Vite 会自动尝试下一个前端端口；后端也会从 `8787` 开始顺延尝试，例如 `8788`、`8789`。使用 `pnpm dev` 同时启动时，前端代理会自动读取后端实际端口。

## 配置模型

复制 `.env.example` 为 `.env`，填入：

```bash
LLM_API_KEY=你的 API Key
LLM_MODEL=deepseek-v4-flash
LLM_BASE_URL=https://api.deepseek.com
PORT=8787
LLM_THINKING=disabled
```

`LLM_BASE_URL` 使用 OpenAI 兼容的 `/chat/completions` 服务地址。DeepSeek 的 OpenAI 兼容地址是 `https://api.deepseek.com`。页面顶栏可以切换 `deepseek-v4-flash` / `deepseek-v4-pro`，也可以临时切换“思考 开/关”，会覆盖 `.env` 里的默认值。没有真实 key 时，可以设置 `LLM_MOCK=1` 验证本地流式 UI。

## 固定上下文

根目录的 `context/` 是项目自带的出厂固定上下文模板。首次启动时，后端会把它复制到 `data/template/context/` 作为当前世界模板，再复制到 `data/save/context/` 作为玩家当前存档。运行时真正发送给模型、并且会被设置页编辑的是 `data/save/context/*.md`。

后端会读取当前存档 `data/save/context/` 中带数字前缀的 `.md` 文件，例如 `001-user-fixed-context.md`、`010-world-agent-role.md`、`020-world-agent-tools.md`，按数字从小到大拼接后发送给模型。没有数字前缀的 `.md` 不会加载，避免顺序不明确。

页面右上角“更多”设置里可以编辑 `data/save/context/001-user-fixed-context.md`。`001-user-fixed-context.md` 适合写当前玩家存档里的长期背景、角色设定、回答偏好和长期目标；其他 Agent 工具说明文档用于告诉模型有哪些工具、什么时候查询、什么时候修改，以及如何通过后端工具调用推进游戏。

`015-story-blueprint.md` 是世界作者维护的剧情蓝图，包含既定世界真相、推荐主线、人物知情边界、关键节点、分支和偏离处理。玩家可以在固定上下文预览中查看它，但不能通过设置页编辑。它属于世界而不是项目系统规则：随基础世界和完整存档导入导出，重置当前存档时从 `data/template/context/` 恢复，项目启动时不会用根目录同名文件覆盖已导入世界的版本。游玩过程只更新数据库中的实际剧情进度，不修改蓝图。

`025-world-schema.generated.md` 由后端根据 `server/worldSchemas.js` 自动生成，用来把实体类型、组件类型和关系类型放进固定上下文包。这样模型仍能看到真实 schema，但每次动态请求里不再重复携带 `schemas` 字段。

根目录 `context/` 会随 Git 提交同步，适合放出厂默认说明。普通系统上下文会同步到模板和存档；`001-user-fixed-context.md`、`015-story-blueprint.md` 与自动生成的 `025-world-schema.generated.md` 不参与这种系统覆盖。无论写在哪个 Markdown 里，都不要放 API Key 或隐私信息。真正的工具白名单、数据库写入校验和权限边界仍在后端代码里，Markdown 只负责给模型提供说明。

## 游戏世界数据库

首次启动后端时会自动创建两份世界数据：

- `data/template/`：当前世界模板，包含模板 SQLite 和模板固定上下文。重置存档会回到这里。
- `data/save/`：当前玩家存档，包含可变 SQLite、可变固定上下文和前端可导出的聊天记录。

运行时世界读取、AI 写入和固定上下文编辑都只作用于 `data/save/`。根目录 `context/` 和代码里的 seed 只作为出厂初始来源，不会被玩家游玩直接修改。

核心结构：

- `entities`：玩家、人物、场景、道具、任务、事件、阵营、设定条目。
- `components`：挂在实体上的 JSON component，例如 `identity`、`scene`、`stats`、`status`、`memory`、`inventory`、`quest`、`schedule`。
- `relationships`：实体之间的关系边，例如 `located_in`、`ownership`、`exit_to`、`knows`、`trust`、`mentions`。
- `entity_aliases` + `entity_search_fts`：别名和 SQLite FTS 全文搜索。
- `events`、`conversations`、`agent_runs`、`agent_steps`：世界事件、对话与 Agent 执行审计。

`data/template/`、`data/save/`、`data/*.sqlite`、`data/*.sqlite-wal`、`data/*.sqlite-shm` 会被 `.gitignore` 忽略，避免把本地模板和存档提交到公开仓库。

设置页的数据管理功能提供：

- `重置当前存档`：用 `data/template/` 覆盖 `data/save/`，并清空当前聊天。
- `导出基础世界`：导出当前模板世界、模板固定上下文、展示层数据库和图片素材，不包含聊天记录。
- `导出完整存档`：导出当前模板、当前玩家存档、当前固定上下文、展示层数据库、图片素材和浏览器聊天记录。
- `导入世界包`：导入 `.newchat-save.json` 后覆盖当前模板和当前存档；如果包里包含展示层数据，会整体替换 `data/presentation/` 下的展示数据库和图片素材；如果包里有聊天记录，前端会恢复到 localStorage。

### 角色状态立绘

角色默认立绘仍使用 `presentation_entity_bindings.portrait_asset_id`。可在该绑定的 `metadata.portraits` 中按状态配置额外的素材 id，目前支持 `happy`、`angry`、`disappointed`、`hurt` 和 `wounded`；缺少状态素材时会自动回退默认立绘。

内置角色也支持按文件名自动发现状态立绘，例如玉芬的默认文件为 `characters/npc-character_yufen-idle.png`，对应愤怒立绘可放在 `characters/npc-character_yufen-angry.png`。服务启动时会自动登记存在的状态文件并保留已经手工配置的绑定。

## 跑团规则知识库

根目录 `rules/` 是项目自带的出厂规则模板。首次启动时，后端会把它复制到 `data/template/rules/`，再复制到 `data/save/rules/`。运行时世界 Agent 只读取 `data/save/rules/`。

规则通过 `rules/manifest.json` 声明文档、分类和标签，Markdown 文档用二级标题标记可读取段落：

```md
## [combat.attack-rolls] 攻击检定
```

Agent 可用规则工具：

- `get_rule_toc`：读取当前规则包目录。
- `search_rules`：按关键词、分类、标签搜索规则段落。
- `get_rule_section`：按规则 ID 读取具体规则正文。

规则读取后会自然进入本轮 Agent `previousSteps` 和聊天上下文；项目不维护显式“已读取规则缓存”。如果上下文里已有足够明确的规则文本，Agent 可以复用；如果规则可能已被压缩、遗漏或不确定，Agent 应重新查询规则。

导出基础世界会包含模板规则包；导出完整存档会包含模板规则包和当前存档规则包。导入世界包会覆盖当前规则包；旧导出包如果没有规则文件，会使用当前默认规则初始化。

## 世界 Agent

聊天发送后会进入后端 `/api/world/agent`。后端读取 `data/save/context/*.md` 固定上下文包和当前会话上下文，再让模型通过受控工具循环处理任务。AI 不直接执行 SQL，只能使用后端工具读写当前玩家存档；需要世界事实时必须显式调用读取工具。

第一版工具包括：

- `search_entities`：按名称、别名、FTS、类型、场景搜索实体。
- `get_entity_bundle`：读取实体详情、组件、关系、近期事件。
- `get_current_scene` / `get_scene_entities`：读取当前场景或指定场景上下文。
- `get_inventory` / `execute_item_action`：读取背包并通过统一硬逻辑使用、装备、展示、拾取或丢弃道具。
- `get_rule_toc` / `search_rules` / `get_rule_section`：按需读取跑团规则。
- `get_time_state`：读取权威时间检查点和检查点之后尚未结算的剧情。
- `update_time`：玩家查询时间时，按剧情分项结算耗时并推进检查点游标。
- `transition_scene`：分别结算上一场景尚未结算的剧情耗时与赶路耗时，再原子推进时间和切换场景。
- `apply_world_patch`：唯一通用写入入口，支持 dry run、diff、undoOperations 和 schema 校验。移动实体位置时使用 `set_location` 子操作；普通关系才使用 `set_relationship`。
- `dm_speak`：输出普通 DM 叙事、动作描写、环境变化、规则结果或说明。
- `npc_speak`：让某个 NPC 以独立气泡说出纯对白。

配置真实模型时，World Agent 使用 API 原生 `tools/tool_calls/tool` 消息链；模型不再调用工具并返回普通 assistant 内容时，本轮自然结束。DeepSeek 思考模式开启时会在同一轮工具循环内回传 `reasoning_content`；Mock 或缺少模型配置时只使用本地 fallback 规划。

读取、搜索、掷骰、写库、切换场景等工具默认静默；普通 DM 叙事使用 `dm_speak`，NPC 独立发言使用 `npc_speak`，不再使用顶层 `say` 字段或 `<npc-speech>` 标签。`npc_speak.content` 只写 NPC 实际说出口的纯对白，`npcEntityId` 必须来自已有实体。`dm_speak` / `npc_speak` 只是最终展示工具，不能替代读取、搜索、掷骰、规则裁定或世界数据写入。

游戏视图舞台右上角提供背包抽屉，支持分类、数量、装备、治疗类消耗品、剧情道具展示、拾取和丢弃；按钮操作与自然语言操作共用同一后端动作服务。右侧“游戏世界”面板会展示当前场景、场景人物、场景道具、出口、实体详情和最近 Agent 工具步骤。

### 多 worktree 共享配置

后端会按以下顺序读取配置，后面的文件会覆盖前面的文件，但不会覆盖操作系统环境变量：

1. `NEWCHAT_CONFIG_FILE` 指向的文件。
2. `NEWCHAT_CONFIG_DIR/config.env`。
3. 当前 Git 仓库 common dir 下的 `newchat/config.env`。
4. 当前 worktree 根目录的 `.env`。

推荐把真实 API Key 放在 Git common dir：同一个仓库创建出的多个 `git worktree` 都会读到同一份配置，而且该文件不会进入 Git 提交。

当前仓库的共享配置路径可以用下面命令查看：

```bash
git rev-parse --git-common-dir
```

然后配置文件位置是：

```text
<git-common-dir>/newchat/config.env
```

## 脚本

```bash
pnpm dev      # 同时启动前端和后端
pnpm run server   # 只启动后端
pnpm build    # TypeScript 检查并构建前端
pnpm preview  # 预览构建产物
```
