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

根目录的 `context/` 是所有对话共享的固定上下文包。后端会读取其中带数字前缀的 `.md` 文件，例如 `001-user-fixed-context.md`、`010-world-agent-role.md`、`020-world-agent-tools.md`，按数字从小到大拼接后发送给模型。

页面右上角“更多”设置里可以编辑 `context/001-user-fixed-context.md`，也可以直接修改 `context/` 下的 Markdown 文件后刷新页面。`001-user-fixed-context.md` 适合写项目长期背景、角色设定、回答偏好和长期目标；其他 Agent 工具说明文档用于告诉模型有哪些工具、什么时候查询、什么时候修改、输出什么 JSON 格式。

`context/` 下的文档会随 Git 提交同步，请不要在里面写 API Key、隐私信息或不希望公开的内容。真正的工具白名单、数据库写入校验和权限边界仍在后端代码里，Markdown 只负责给模型提供说明。

## 游戏世界数据库

首次启动后端时会自动创建 `data/newchat.sqlite`。它是游戏世界的唯一主数据源，用来保存长期存在的实体、组件、关系、事件、对话日志和 Agent 工具调用记录。

核心结构：

- `entities`：玩家、人物、场景、道具、任务、事件、阵营、设定条目。
- `components`：挂在实体上的 JSON component，例如 `identity`、`scene`、`stats`、`status`、`memory`、`inventory`、`quest`、`schedule`。
- `relationships`：实体之间的关系边，例如 `located_in`、`ownership`、`exit_to`、`knows`、`trust`、`mentions`。
- `entity_aliases` + `entity_search_fts`：别名和 SQLite FTS 全文搜索。
- `events`、`conversations`、`agent_runs`、`agent_steps`：世界事件、对话与 Agent 执行审计。

`data/*.sqlite`、`data/*.sqlite-wal`、`data/*.sqlite-shm` 会被 `.gitignore` 忽略，避免把本地存档提交到公开仓库。`context/` 只作为系统级固定提示，不存人物、道具、场景等世界数据。

## 世界 Agent

聊天发送后会进入后端 `/api/world/agent`。后端读取 `context/*.md` 固定上下文包、当前会话摘要/最近消息、当前场景概览，再让模型通过受控工具循环处理任务。AI 不直接执行 SQL，只能使用后端工具读写世界。

第一版工具包括：

- `search_entities`：按名称、别名、FTS、类型、场景搜索实体。
- `get_entity_bundle`：读取实体详情、组件、关系、近期事件。
- `get_current_scene` / `get_scene_entities`：读取当前场景或指定场景上下文。
- `enter_scene`：校验出口并切换玩家当前场景。
- `apply_world_patch`：唯一通用写入入口，支持 dry run、diff、undoOperations 和 schema 校验。
- `finish`：结束本轮 Agent 任务并返回最终答复。

前端右侧“游戏世界”面板会展示当前场景、场景人物、道具、出口、实体详情和最近 Agent 工具步骤。第一版只做轻量场景实体化，不启用复杂时间系统或 NPC 后台自主行动。

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
