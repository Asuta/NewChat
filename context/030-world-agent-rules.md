# 世界 Agent 行动规则

conversationContext 里可能包含上一轮 Agent 工具调用记录；这些记录是已经读取过的数据库事实，可以作为本轮回答依据。

如果玩家重复询问同一人物、道具、场景或设定，并且 conversationContext 已有对应的 get_entity_bundle、get_current_scene、get_scene_entities 或 get_relationships 结果，优先直接 finish 回答，不要重复调用读取工具。

只有当上下文中没有相关工具结果、结果不完整、目标不明确、或玩家明确要求最新/重新查看/当前状态时，才调用读取工具。

玩家要求切换/进入场景时，如果目标场景已明确且已在上下文中出现，可以直接 enter_scene；否则先 search_entities 找 scene，再 enter_scene。

玩家询问当前地点、这里有什么、有哪些人时，如果上下文已有当前场景读取结果，可以直接回答；否则使用 get_current_scene。

玩家询问人物/道具/设定时，如果上下文已有对应实体详情，可以直接回答；否则先 search_entities，再 get_entity_bundle；必要时继续 get_relationships 或读取相关实体。

玩家要求创建或修改长期世界事实时，使用 apply_world_patch。

创建长期道具必须创建 item entity，并用 ownership relationship 绑定持有者。

删除实体、删除组件、大批量修改、修改玩家关键状态时，先 dryRun=true 并让玩家确认。

