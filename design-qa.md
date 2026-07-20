# 文字输出框透明度 Design QA

- source visual truth path: `C:/Users/fun/AppData/Local/Temp/codex-clipboard-0a6a6c0b-3536-4054-adba-97468a8b81a8.png`，结合用户明确要求“输出框整体增加透明效果”。
- implementation screenshot path: `C:/Users/fun/.codex/visualizations/2026/07/20/019f7e23-4fd7-7ee0-acf0-f621edb2b4c2/dialogue-transparency-visible.png`
- viewport: 1280 × 720，宽屏桌面。
- state: 灰烬礼拜堂场景，剧情页签选中，当前页文字全部展开，场景背景加载完成。
- primary interactions tested: 剧情输出框点击展开当前页全文。
- console errors checked: 无 warning / error。

## Full-view comparison evidence

已在同一比较输入中打开上一版实现截图与修正版实现截图。上一版输出框呈接近实色的深蓝色块，背景石柱和地面细节基本不可辨；修正版可清楚看见人物下方石柱、地面和光影继续穿过面板，同时正文保持清晰。

## Focused region comparison evidence

无需单独局部图：输出框在 1280 × 720 全图中占 1182 × 145 像素，文字、边框及透出的背景纹理均可直接辨认，完整视图已足够判断本次唯一目标。

## Findings

- 无剩余 P0 / P1 / P2 问题。
- 字体与排版：旁白标签与正文同行，16px 正文字号、行高和换行均保持稳定。
- 间距与布局节奏：输出框高度、内边距、翻页按钮和输入区位置未因透明度修改发生漂移。
- 色彩与视觉 Token：旁白面板遮罩由 `0.80 → 0.72` 调整为 `0.58 → 0.48`，悬停遮罩为 `0.64 → 0.54`；模糊从 16px 降到 8px。背景纹理已可见，白色正文仍有充足对比度。
- 图片质量与素材一致性：沿用原场景背景和人物立绘，没有替换、拉伸或新增近似素材。
- 文案内容：剧情文字、旁白标签及页码内容均未被样式修改影响。

## Comparison history

1. Earlier finding — P1：第一版虽然降低了 CSS alpha，但深色遮罩为 `0.80 → 0.72` 且模糊为 16px，在暗色场景中仍呈现为近乎不透明的色块，用户无法感知透明效果。
2. Fix made：将旁白遮罩降低为 `0.58 → 0.48`，悬停态降低为 `0.64 → 0.54`，并把模糊降至 8px，让背景结构而不只是颜色透出。
3. Post-fix evidence：`dialogue-transparency-visible.png` 中面板下的石柱、地面和明暗变化连续可见；浏览器计算样式确认单层半透明渐变和 8px backdrop blur 已生效。

## Implementation Checklist

- [x] 透明效果在暗色场景中肉眼可辨。
- [x] 正文和旁白标签对比度足够。
- [x] 文字分页、框体尺寸和输入区布局无回归。
- [x] 构建与测试通过。
- [x] 浏览器控制台无 warning / error。

## Follow-up Polish

- P3：如果后续场景存在大面积高亮背景，可按场景明度再考虑自适应遮罩；当前暗色礼拜堂场景不需要额外处理。

final result: passed
