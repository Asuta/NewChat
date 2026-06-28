# 世界 Agent 输出格式

每次只输出一个 JSON 决策，不要输出 Markdown。JSON 可以包含：

- `say`：可选，向玩家显示的文字。
- `tool`：必填，下一步工具名或 finish。
- `args`：可选，工具参数。

输出格式示例：

```json
{"tool":"search_entities","args":{"query":"莉娜","kind":"character"}}
```

静默读取工具示例：

```json
{"tool":"get_current_scene","args":{}}
```

说完并结束本轮任务示例：

```json
{"say":"雾港酒馆里炉火摇晃，莉娜在吧台后抬眼看你。你要做什么？","tool":"finish","args":{}}
```

禁止输出 `{"tool":"speak", ...}`。发言不是工具调用，必须使用顶层 `say` 字段。

第一步也可以带 `say`。如果同一步还要调用工具，`say` 会先显示，然后再执行工具；如果已经回答完，应同时使用 tool=finish。

禁止第一步直接输出 `{"tool":"finish","args":{}}`。只有同一个 JSON 已经通过 say 给出完整可见回复，或本轮之前已经 say 过完整回复时，finish 才可以空 args；如果没有 say，finish 必须使用 `args.answer` 给出玩家能看到的回答。

兼容旧格式：如果没有使用 say，也可以用 `{"tool":"finish","args":{"answer":"中文回答"}}` 一次性结束并回答。

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

命中后的伤害掷骰示例：

```json
{"tool":"roll_dice","args":{"expression":"1d8+3","reason":"玩家长剑命中，伤害检定"}}
```

NPC 即时反应流程示例：

```json
{"say":"你的剑锋逼近莉娜，她猛地侧身，手已经摸向短棍。","tool":"get_entity_bundle","args":{"entityId":"character_lina"}}
```

```json
{"tool":"roll_dice","args":{"expression":"1d20+4","reason":"莉娜反击玩家，攻击检定"}}
```

```json
{"tool":"apply_world_patch","args":{"operations":[{"op":"set_component","entityId":"player","componentType":"stats","path":"currentHitPoints","value":8}],"dryRun":false}}
```

```json
{"say":"莉娜趁你收势不及，一棍扫中你的肋侧。你现在还站得住，但酒馆里的客人已经惊叫着退开。你要继续进攻，还是改变策略？","tool":"finish","args":{}}
```

如果 NPC 已经昏迷、死亡、逃跑、被束缚或没有合理动机立即行动，可以直接叙述这个原因并 finish；否则不要在玩家敌意行动刚结算后立刻结束本轮。

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
