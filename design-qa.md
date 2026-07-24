# Design QA：常驻任务追踪器

- Source visual truth path: `C:\Users\fun\AppData\Local\Temp\codex-clipboard-dbf9d0ba-5764-444a-8a03-3d30406ff26e.png`
- Source stage crop: `C:\Users\fun\.codex\worktrees\346e\NewChat\.codex-artifacts\task-tracker-source-stage.png`
- Implementation screenshot: `C:\Users\fun\.codex\worktrees\346e\NewChat\.codex-artifacts\task-tracker-stage-final.png`
- Full-view comparison: `C:\Users\fun\.codex\worktrees\346e\NewChat\.codex-artifacts\task-tracker-design-comparison.png`
- Focused comparison: `C:\Users\fun\.codex\worktrees\346e\NewChat\.codex-artifacts\task-tracker-focused-comparison.png`
- Browser viewport: `1656 × 767` CSS px
- Game-stage bounds: `840.89 × 473` CSS px
- Device pixel ratio: `1.125`
- Source pixels: `1110 × 650`; stage crop `1053 × 593`
- Implementation stage screenshot pixels: `830 × 467`
- Density normalization: source stage crop was downsampled to `830 × 467` before comparison.
- State: desktop game mode, story tab selected, two active quests, city bus station scene.

## Findings

No actionable P0, P1, or P2 differences remain.

- The compact task list now occupies the left-side region indicated in the annotated reference.
- The former bottom task tab and purple task panel are absent.
- The tracker remains visible while switching between story and inventory.
- The compact tracker can expand in place to expose every visible quest and its status without restoring the deep bottom frame.
- Selecting a quest expands its description, current progress, and completion criteria inside the scrollable task log.
- The transparent treatment preserves the background artwork while the dual text shadow keeps titles readable.

## Required fidelity surfaces

- Fonts and typography: existing project font stack is preserved. Quest titles use the same compact game-HUD weight; summaries are intentionally quieter and limited to two lines.
- Spacing and layout rhythm: the tracker starts below the player status card, leaves a clear gap, and remains above the dialogue area. Two active quests fit without crowding the character.
- Colors and visual tokens: warm gold and off-white reuse the existing HUD palette. There is no dark panel fill, purple card, heavy border, or large shadowed container.
- Image quality and asset fidelity: the scene background, portrait, mini-map, and existing icon assets are unchanged. No new raster asset or placeholder was required.
- Copy and content: live quest titles and progress summaries are preserved. Completion criteria stay hidden in compact mode and are available in the expanded task log.

## Interaction and runtime checks

- Switched from chat mode to game mode.
- Opened the inventory tab and confirmed the task tracker stayed visible.
- Returned to the story tab and confirmed the task tracker stayed visible.
- Confirmed the old task tab is no longer rendered.
- Expanded and collapsed the left tracker, confirming both controls and the active-task completion criteria.
- Selected an individual task and confirmed its dedicated detail region can be opened and closed.
- Checked the expanded data path: it renders the complete `quests.items` collection with status labels instead of the compact four-item active slice.

## Comparison history

- Pass 1: the full-stage and focused comparisons showed the requested left-side placement, removal of the deep bottom task frame, and acceptable readability over the supplied scene. No P0/P1/P2 fix was required after comparison.

## Follow-up polish

- P3: on unusually narrow desktop layouts the progress summaries become very small because the entire fixed game stage scales down; the quest titles remain legible and preserve the intended low-noise treatment.

final result: passed
