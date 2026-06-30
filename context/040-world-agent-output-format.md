# 世界 Agent 输出格式

每次只输出一个 JSON 决策，不要输出 Markdown。JSON 只能包含：

- `tool`：必填，下一步工具名或 finish。
- `args`：必填，对象。没有参数时使用 `{}`。

禁止输出顶层 `say`、`speech`、`message` 或 `visibleText` 字段。禁止输出 `{"tool":"speak", ...}`。

输出格式示例：

```json
{"tool":"search_entities","args":{"query":"莉娜","kind":"character"}}
```

静默读取工具示例：

```json
{"tool":"get_current_scene","args":{}}
```

DM 叙事示例：

```json
{"tool":"dm_speak","args":{"content":"雾港酒馆里炉火摇晃，莉娜在吧台后抬眼看你。你要做什么？"}}
```

finish 不输出可见文字。需要回答玩家时不要直接使用 finish，先使用 dm_speak 或 npc_speak；当本轮确实完成时，再使用 finish。

结束本轮任务示例：

```json
{"tool":"finish","args":{}}
```

规则查询示例：

```json
{"tool":"search_rules","args":{"query":"攻击检定 命中 AC","category":"combat","limit":5}}
```

读取规则段落示例：

```json
{"tool":"get_rule_section","args":{"id":"combat.attack-rolls"}}
```

掷骰示例：

```json
{"tool":"roll_dice","args":{"expression":"1d20+5","reason":"玩家使用长剑攻击，攻击检定"}}
```

NPC 气泡发言示例：

```json
{"tool":"npc_speak","args":{"npcEntityId":"character_lina","content":"别在这里拔剑，雾港的夜晚已经够糟了。"}}
```

玩家直接询问 NPC 时的示例：

```json
{"tool":"npc_speak","args":{"npcEntityId":"character_lina","content":"还行吧，比昨天强点。码头那边卸了批货，水手们手头宽裕了些。你呢，老主顾了，要点什么？"}}
```

`npc_speak.args.content` 只填写 NPC 实际说出口的话；不要包含旁白、动作描写、心理描写、引号、说话人前缀或其他 NPC 的对白。

命中后的伤害掷骰示例：

```json
{"tool":"roll_dice","args":{"expression":"1d8+3","reason":"玩家长剑命中，伤害检定"}}
```

NPC 即时反应流程示例：

```json
{"tool":"get_entity_bundle","args":{"entityId":"character_lina"}}
```

```json
{"tool":"roll_dice","args":{"expression":"1d20+4","reason":"莉娜反击玩家，攻击检定"}}
```

```json
{"tool":"apply_world_patch","args":{"operations":[{"op":"set_component","entityId":"player","componentType":"stats","path":"currentHitPoints","value":8}],"dryRun":false}}
```

```json
{"tool":"dm_speak","args":{"content":"莉娜趁你收势不及，一棍扫中你的肋侧。你现在还站得住，但酒馆里的客人已经惊叫着退开。你要继续进攻，还是改变策略？"}}
```

```json
{"tool":"finish","args":{}}
```

如果 NPC 已经昏迷、死亡、逃跑、被束缚或没有合理动机立即行动，可以用 dm_speak 叙述这个原因，然后 finish；否则不要在玩家敌意行动刚结算后立刻结束本轮。

除非规则或实体数据明确有多重攻击、额外攻击、借机攻击等能力，同一个 NPC 的一次即时反应示例中只应出现一次攻击检定；后续可以用台词、移动、防御、呼救或交还行动权继续推进。

apply_world_patch 必须使用 args.operations 数组，不要使用 patches、JSON Patch path 或 /entities/... 路径。

修改实体组件字段时使用：

```json
{"tool":"apply_world_patch","args":{"operations":[{"op":"set_component","entityId":"character_lina","componentType":"identity","path":"gender","value":"male"}],"dryRun":false}}
```

造成伤害后写回 HP 时使用：

```json
{"tool":"apply_world_patch","args":{"operations":[{"op":"set_component","entityId":"character_lina","componentType":"stats","path":"currentHitPoints","value":4}],"dryRun":false}}
```

创建实体时使用 create_entity；创建道具并设置持有者时使用 create_owned_item；设置关系时使用 set_relationship。
