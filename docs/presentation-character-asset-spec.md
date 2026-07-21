# 人物展示素材生成规范

本文档是 NewChat 人物展示素材的项目级标准。新建或替换默认立绘、情绪立绘、受伤立绘时都必须遵守；除非用户明确批准例外，不得在同一批素材中混用半身、四分之三身和全身构图。

## 1. 标准成品

- 文件格式：带透明通道的 PNG（RGBA）。
- 画布尺寸：`1024 × 1536`，竖版 `2:3`。
- 景别：统一为腰部以上半身像，下边缘裁切在腰部至胯部上方。
- 禁止出现大腿、膝盖、小腿和脚；也不要生成只到肩部的头像特写。
- 人物保持站姿或自然直立姿态，机位与眼睛大致平齐；身体可以轻微侧转，但不得用俯拍、仰拍或远景改变人物比例。
- 人物水平居中，头顶距离画布顶部约为画布高度的 `4%–7%`，人物主体高度约占画布的 `90%–96%`。
- 人物下缘与画布底边对齐，左右肩膀、头发和关键服装轮廓不得被意外切断。
- 最终文件只能保留人物主体，不得残留场景、纯色底、地面、投影、文字、水印、边框或明显抠图白边。

画风、年代、材质和写实程度由当前世界包决定，可以因世界而不同；画布、景别、人物占比和状态图对齐规则不能随画风变化。

## 2. 默认立绘（idle）

`idle` 是同一人物所有状态立绘的身份与构图基准。首次生成时应从世界数据读取人物的年龄观感、身份、性格、服装、所属时代和世界画风，但不得让这些描述覆盖本规范的固定景别。

提示词必须包含与下列含义等价的构图约束：

```text
portrait-oriented 2:3 canvas, 1024x1536;
single character, waist-up upper-body portrait, cropped between waist and upper hips;
eye-level camera, centered composition, natural upright pose;
head near the top with consistent margin, body anchored to the bottom edge;
no full body, no three-quarter body crop, no thighs, no knees, no legs, no feet;
no close-up headshot, no cropped head or shoulders;
isolated character, no scenery, no text, no watermark
```

建议同时加入以下反向约束：

```text
full body, three-quarter body, long shot, wide shot, sitting, kneeling,
visible thighs, visible knees, visible legs, visible feet,
close-up face, bust-only crop, cropped head, cropped shoulders,
background scene, floor, cast shadow, frame, text, logo, watermark
```

生成模型可能无法直接提供可靠透明背景。可以先使用干净、易抠图的背景生成，再执行抠图；项目中登记和使用的最终文件必须是透明 PNG。

## 3. 状态与动作立绘

- 必须使用已经验收的 `idle` 立绘作为参考图进行编辑，不要仅凭文字重新生成同一人物。
- 保持人物身份、脸型、五官、发型、服装、配色、身体朝向和轮廓一致。
- 保持与 `idle` 相同的画布、头部大小、头部中心位置、肩宽、裁切线和底部锚点。
- 状态变化只修改表情、视线和必要的小幅动作；不要因为“愤怒”“受伤”等状态自动拉近镜头或改成全身像。
- `happy`、`angry`、`disappointed` 等情绪图以表情变化为主。
- `hurt`、`wounded` 可以增加伤痕、血迹、姿态紧张或轻微身体倾斜，但仍须保持同一景别和构图。
- 参考图编辑完成后同样执行透明背景检查，不得把参考图底色带入成品。

状态图提示词必须包含：

```text
preserve the exact same character identity, face, hairstyle, outfit, palette and silhouette;
preserve the exact same camera distance, waist-up crop, head size, head position, shoulder scale and bottom alignment as the reference;
change only the requested expression or state;
no zoom, no reframing, no full body, no legs, no feet
```

## 4. 文件与展示层边界

- 默认立绘命名：`data/presentation/assets/characters/npc-<entityId>-idle.png`。
- 状态立绘命名：`data/presentation/assets/characters/npc-<entityId>-<state>.png`。
- 状态名以项目实际支持的 `neutral`、`happy`、`angry`、`disappointed`、`hurt`、`wounded` 为准；默认图使用 `idle` 文件名并映射到 `neutral`。
- 原始生成图、候选图和任务清单放在 `data/generated-assets/<provider-or-run-id>/`，不要混入正式素材目录。
- 正式素材只在 presentation 层登记。不要把本地图片路径写进世界 SQLite、ECS 实体、剧情蓝图、固定上下文、GM 行为或故事事件。
- 同一人物已有手工绑定时，不得在未确认的情况下覆盖其 `presentation_entity_bindings` 或状态素材映射。

## 5. 生成流程

1. 读取人物世界数据和当前世界的视觉风格参考。
2. 按本规范生成 `idle` 候选图；先验收景别和构图，再验收人物造型。
3. 对选中的 `idle` 执行抠图，输出透明 PNG。
4. 使用该 `idle` 作为唯一参考生成所有状态图，并逐张抠图。
5. 按稳定文件名放入 `data/presentation/assets/characters/`，再更新 presentation 层素材和绑定。
6. 在宽屏游戏舞台中同时显示至少两名人物，检查头部大小和视觉高度是否一致。

## 6. 验收清单

每张人物素材在登记前必须满足：

- [ ] 尺寸为 `1024 × 1536`，PNG 带透明通道。
- [ ] 景别为腰部以上，没有大腿、膝盖、腿或脚。
- [ ] 不是头像特写，头顶、肩膀和发型没有被切断。
- [ ] 头顶留白、人物高度和底部锚点符合统一标准。
- [ ] 没有场景、地面、投影、文字、水印和抠图边缘残留。
- [ ] 状态图与 `idle` 的身份、服装、缩放、裁切和位置一致。
- [ ] 文件名、状态名和 presentation 绑定正确。
- [ ] 已在宽屏游戏舞台中与其他合规人物并排检查，人物视觉比例没有明显跳变。

如果某个特殊角色确实需要全身或不同景别，必须先获得用户明确同意，并为该角色的全部状态图使用同一例外标准；不得把一次生成偏差当作例外保留。
