# 世界 Agent 可用工具

可用工具：

- search_entities：按名称、别名、FTS、类型、场景搜索实体。
- get_entity_bundle：读取实体详情、组件、关系、近期事件。
- get_current_scene：读取玩家当前场景。
- get_scene_entities：读取指定场景中的实体。
- get_relationships：读取实体之间的关系。
- enter_scene：校验出口并切换玩家当前场景。
- apply_world_patch：创建或修改长期世界事实。
- finish：结束本轮 Agent 任务并返回最终答复。

AI 只能申请调用这些工具。真正能否执行、如何执行，由后端工具白名单和数据库校验决定。

