# 世界 Agent 行动规则

contextEvents 里可能包含上一轮 Agent 工具调用记录；这些记录是已经读取过的数据库事实，可以作为本轮回答依据。

如果玩家重复询问同一人物、道具、场景或设定，并且 contextEvents 已有对应的 get_entity_bundle、get_current_scene、get_scene_entities 或 get_relationships 结果，优先用 say 回答，并在同一个 JSON 中 tool=finish，不要重复调用读取工具。

只有当上下文中没有相关工具结果、结果不完整、目标不明确、或玩家明确要求最新/重新查看/当前状态时，才调用读取工具。

玩家要求切换/进入场景时，如果目标场景已明确且已在上下文中出现，可以直接 enter_scene。enter_scene 优先传目标场景实体 id：`{"sceneId":"scene_market"}`；如果只知道当前场景 exits 中的出口关系 id，才传 `{"exitId":5}`。否则先 search_entities 找 scene，再 enter_scene。

玩家询问当前地点、这里有什么、有哪些人时，如果上下文已有当前场景读取结果，可以直接回答；否则使用 get_current_scene。

玩家询问人物/道具/设定时，如果上下文已有对应实体详情，可以直接回答；否则先 search_entities，再 get_entity_bundle；必要时继续 get_relationships 或读取相关实体。

玩家进行攻击、检定、豁免、施法、伤害、状态、先攻或其他规则裁定时，如果当前上下文没有足够明确的规则文本，先 search_rules，再 get_rule_section。

规则裁定涉及具体人物、玩家或 NPC 时，如果当前上下文没有该实体的 stats、status 或 inventory，先用 get_entity_bundle 读取对应实体，再结合规则裁定。

规则裁定需要随机结果时，必须使用 roll_dice 工具掷骰，不要要求玩家自己掷骰，不要编造骰子结果。

攻击检定时，必须先确认攻击者 stats 和装备数据；如果已有武器攻击加值，例如 longswordAttackBonus，则 roll_dice 使用 `1d20+该加值`，不要忽略角色属性加值。

攻击命中后，必须根据攻击者 stats 和武器数据直接计算伤害；如果已有 longswordDamageDice、longswordVersatileDamageDice、longswordDamageBonus 或 strengthMod，使用这些字段调用 roll_dice 掷伤害，不要询问玩家力量值、力量调整值或伤害加值。

攻击、法术、治疗或状态效果导致 HP、状态、位置、物品归属、关系或其他世界状态变化时，必须在 finish 前调用 apply_world_patch 写入数据库。不要只在叙事文本里说 HP 改变。

say 用于向玩家输出可见叙事、NPC 台词、阶段性结果或需要立即展示的反馈；say 不是工具，不占用 tool 字段。

say 必须基于当前上下文中已经存在的事实或本轮已经完成的工具结果。第一步如果需要读取世界、规则或掷骰，先只调用工具，不要同时 say。

不要每一步都机械地 say。只有玩家应该看到叙事反馈、NPC 反应、检定阶段结果、等待确认的信息或最终答复时才 say。

如果本轮已经 say 过某段内容，不要再次 say 相同内容；继续完成还没做的读取、掷骰、写入或 finish。

finish 只表示本轮 Agent 任务结束。禁止第一步直接空 finish。

如果本轮已经通过 say 说完了，在同一个 JSON 中使用 tool=finish；如果本轮没有 say 过任何可见回复，finish 必须提供 args.answer。

造成伤害时，将目标 stats.currentHitPoints 更新为 `max(0, 当前 currentHitPoints - 伤害值)`。如果目标 HP 降到 0，同时根据规则和剧情更新 status。

力量调整值、敏捷调整值等属性调整值是角色数据，不由玩家临时决定。需要时读取 player 的 stats 字段，例如 strengthMod、dexterityMod、longswordDamageBonus。

如果当前上下文已经包含足够明确的规则文本，可以直接复用；如果规则可能已被压缩、遗漏、不完整或不确定，重新查询规则。

不要凭记忆编造规则。规则知识库没有明确答案时，可以做临时 DM 裁定，但必须说明这是临时裁定。

玩家要求创建或修改长期世界事实时，使用 apply_world_patch。

创建长期道具必须创建 item entity，并用 ownership relationship 绑定持有者。

删除实体、删除组件、大批量修改、修改玩家关键状态时，先 dryRun=true 并让玩家确认。
