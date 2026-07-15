# Stage 全屏游戏模式 Design QA

- Source visual truth: `C:/Users/fun/AppData/Local/Temp/codex-clipboard-aeae03c4-3248-481f-a3db-dbfb4f14d3e0.png`
- Implementation screenshot: `C:/Users/fun/Desktop/NewProject/NewChat/docs/design-qa/stage-fullscreen-final-device-tall.png`
- Route: `http://127.0.0.1:5175/stage`
- Viewport: 1280 × 720 CSS pixels; screenshot captured at Windows DPR 1.25 (1600 × 1125 including capture padding)
- State: 灰烬礼拜堂、艾蕾娜在场、剧情页签、行动输入空闲

## Full-view comparison evidence

The source screenshot marks the existing in-app game canvas as the visual truth. The implementation reuses that exact `GameStageCanvas`, its existing scene/character assets, tokens, typography, dialogue panel, inventory tab, minimap, and action composer while removing the surrounding sidebar, top bar, chat thread, and world panel. The stage occupies the full 1280 × 720 logical viewport. On wider viewports it preserves the 16:9 game composition and uses dark gutters instead of stretching the artwork.

## Focused region comparison evidence

No separate focused crop was required because the entire implementation screenshot is the requested game region and the important details are legible at the captured resolution. The following regions were checked directly: scene/time badge, fullscreen control, minimap, character cutout and health bar, story/inventory tabs, dialogue paging, action input, and send control.

## Findings

- No actionable P0/P1/P2 visual mismatch remains.
- The displayed dialogue text differs from the source screenshot because it reflects the current live conversation state; this is expected product behavior rather than design drift.
- The implementation capture includes top and bottom padding caused by the in-app browser's DPR screenshot surface. DOM measurements confirm the actual route is exactly 1280 × 720 with no page overflow.

## Required fidelity surfaces

- Fonts and typography: passed. The implementation reuses the same game-stage font stack, weights, sizes, and hierarchy as the source component.
- Spacing and layout rhythm: passed. The 1280 × 720 stage, 48px side margins for the interaction panel, character placement, minimap, dialogue panel, and composer spacing match the existing game mode.
- Colors and visual tokens: passed. Existing dark glass panels, cyan accents, muted borders, and scene overlays are reused unchanged.
- Image quality and asset fidelity: passed. The same presentation-layer backdrop and transparent character assets are used; no placeholders or recreated assets were introduced.
- Copy and content: passed. Labels, placeholder text, tabs, accessibility names, and live scene content come from the existing product implementation.

## Interaction verification

- Story and inventory tabs switch correctly.
- Inventory categories and items render from live data.
- Filling the action input enables the send button; no model request was submitted during QA.
- The standalone route has no sidebar/app-shell DOM and no body overflow.
- Browser console warnings/errors: none.

## Comparison history

1. Initial pass found a P1 layout issue: the standalone view inherited the main game view's 180px chat-height reservation, so the stage could not fill the viewport.
2. Fixed by overriding the standalone chat reservation to 0px and permitting the standalone stage to upscale while preserving 16:9.
3. Post-fix evidence: at 1280 × 720 the stage rect is exactly 1280 × 720 and the action composer bottom is 695.2px; at 1862 × 923 the stage is 1640.89 × 923 and centered with dark side gutters.

## Implementation checklist

- [x] Reuse the production game view and interactions.
- [x] Remove surrounding application chrome from `/stage`.
- [x] Fit the game canvas to the full viewport without distortion.
- [x] Preserve inventory, action input, entity actions, and fullscreen control.
- [x] Verify tests, build, DOM layout, interactions, and console output.

## Follow-up polish

- No blocking follow-up polish remains.

final result: passed
