# 世界数据库结构说明（自动生成）

这个文档由后端根据当前代码里的世界数据库 schema 自动生成，用来告诉世界 Agent 可以使用哪些实体、组件和关系类型。

## Entity Kinds

- `player`
- `character`
- `scene`
- `item`
- `quest`
- `event`
- `faction`
- `lore`

## Component Types

- `identity`
- `scene`
- `stats`
- `status`
- `memory`
- `inventory`
- `quest`
- `schedule`

## Component Shape Notes

- `identity`：常用字段 `role`、`description`、`background`、`personality`、`notes`，也可以附加 race、gender、age 等描述字段。
- `scene`：需要 `description`；可选 `exits`、`tags`、`visibility`。
- `stats`：键值表，值只能是 number、string、boolean 或 null，例如 `maxHitPoints`、`currentHitPoints`、`armorClass`、`strengthMod`。
- `status`：标准字段为 `state`、`label`、`description`、`canAct`。创建能行动的普通角色时使用 `{"state":"active","label":"正常","description":"该角色状态正常，可以行动。","canAct":true}`。后端也兼容 `alive`、`conscious`、`conditions` 并会自动归一化。
- `inventory`：至少使用 `items` 字符串数组；可以附加 `gold`、`equippedWeaponId` 等字段。
- `quest`：需要 `status`、`title`；可选 `description`、`objectives`、`participants`。
- `memory` 使用 `entries` 数组；`schedule` 使用 `entries` 数组。

## Relationship Types

- `located_in`
- `ownership`
- `exit_to`
- `knows`
- `trust`
- `affinity`
- `hostility`
- `fear`
- `belongs_to`
- `unlocks`
- `requires`
- `mentions`
- `related_to`

## 使用规则

- 查询和修改世界数据时，只能使用以上列出的类型。
- 如果需要新增长期事实，优先复用已有实体、组件和关系类型。
- 不要编造 schema 中不存在的类型；如果现有类型不足以表达，应在回复中说明限制，而不是直接写入未知类型。

> 注意：这个 Markdown 只是写给模型看的说明；真实数据库校验和工具白名单仍然由后端代码控制。
