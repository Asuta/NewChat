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
- npc_speak：让一个已存在实体以独立 NPC 对话气泡发言。参数使用 `npcEntityId` 和 `content`；`content` 只写 NPC 实际说出口的话。
- enter_scene：校验出口并切换玩家当前场景。参数优先使用 `sceneId`（目标场景实体 id，例如 `scene_market`）；如果只有当前场景 exits 里的出口关系 id，也可以使用 `exitId`。
- apply_world_patch：创建或修改长期世界事实。
- finish：结束本轮 Agent 任务。

向玩家输出可见文字时，不使用工具名 speak；在 JSON 决策里使用顶层 `say` 字段。`say` 可以和任意工具同时出现，也可以和 finish 同时出现。

当你希望某个 NPC 看起来像在聊天流里独立说话时，使用 `npc_speak`。普通场景叙事、动作描写、规则结果和 DM 解释仍使用 `say`。

AI 只能申请调用这些工具。真正能否执行、如何执行，由后端工具白名单和数据库校验决定。
