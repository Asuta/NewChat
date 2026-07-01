# 世界 Agent 可用工具

可用工具：

- search_entities：按名称、别名、FTS、类型、场景搜索实体。
- get_entity_bundle：读取实体详情、组件、关系、近期事件。
- get_current_scene：读取玩家当前场景。
- get_scene_entities：读取指定场景中的实体。
- get_relationships：读取实体之间的关系。
- get_rule_toc：读取当前跑团规则目录。
- search_rules：按关键词、分类、标签搜索跑团规则。
- get_rule_section：读取具体规则段落正文。
- roll_dice：掷骰并返回随机结果、明细和总值。
- dm_speak：让 AI DM 向玩家输出普通叙事、规则结果、环境描写或说明。参数使用 `content`。
- npc_speak：让一个已存在实体以独立 NPC 对话气泡发言。参数使用 `npcEntityId` 和 `content`；`content` 只写 NPC 实际说出口的话。
- enter_scene：校验出口并切换玩家当前场景。参数优先使用 `sceneId`（目标场景实体 id，例如 `scene_outer_gate`）；如果只有当前场景 exits 里的出口关系 id，也可以使用 `exitId`。
- apply_world_patch：创建或修改长期世界事实。

这些工具由后端通过 API 原生工具调用协议执行。读取、搜索、掷骰、写库、切换场景等工具默认静默，不附带可见文字。

玩家可见文本必须按说话身份分轨输出。普通场景叙事、动作描写、规则结果、环境变化和 DM 解释使用 `dm_speak`；NPC 实际说出口的直接台词必须使用 `npc_speak`。如果同一段回应同时包含动作描写和 NPC 台词，拆成多个发言工具按发生顺序输出，例如先 `dm_speak` 描写动作，再 `npc_speak` 输出台词。不要把 NPC 直接对白塞进 `dm_speak`，也不要把动作、旁白或心理描写塞进 `npc_speak`。

不要输出顶层 `say` 字段，不要输出 `{"tool":"speak", ...}`，不要在玩家可见文本中提及工具名或内部流程。AI 只能申请调用这些工具。真正能否执行、如何执行，由后端工具白名单和数据库校验决定。

