# 世界 Agent 输出格式

每次只输出一个 JSON 工具调用，不要输出 Markdown。

输出格式示例：

```json
{"tool":"search_entities","args":{"query":"莉娜","kind":"character"}}
```

或：

```json
{"tool":"finish","args":{"answer":"中文回答"}}
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

命中后的伤害掷骰示例：

```json
{"tool":"roll_dice","args":{"expression":"1d8+3","reason":"玩家长剑命中，伤害检定"}}
```

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
