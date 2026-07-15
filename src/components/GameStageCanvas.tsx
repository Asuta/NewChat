import {
  Backpack,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crosshair,
  FlaskConical,
  ImageOff,
  Loader2,
  MapPinned,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type {
  InventoryItem,
  PresentationStage,
  StageDialogueEntry,
  InventoryAction,
  PlayerInventory,
  WorldActionMenuTarget,
  WorldMapState,
  WorldOverview,
} from '../types';
import type { CharacterAttackFeedbackEvent } from './characterAttackFeedback';
import { GameStageCharacter, useCharacterHealthFeedback } from './GameStageCharacter';
import { InventoryPanel } from './InventoryPanel';
import { SceneMiniMap } from './SceneMiniMap';
import {
  countStageMarkdownCharacters,
  parseStageMarkdown,
  sliceStageMarkdownSegments,
  StageMarkdownContent,
} from './StageMarkdownContent';
import type { StageMarkdownMark, StageMarkdownSegment } from './StageMarkdownContent';
import { getVisibleStageCharacters } from './stageCharacterSelection';

const GAME_STAGE_BASE_WIDTH = 1280;
const GAME_STAGE_BASE_HEIGHT = 720;
const GAME_STAGE_MIN_SCALE = 0.3;
const DIALOGUE_LINES_WITH_COMPOSER = 3;
const DIALOGUE_LINES_WITHOUT_COMPOSER = 3;
const TYPEWRITER_INTERVAL_MS = 22;
interface GameStageCanvasProps {
  stage: PresentationStage | null;
  world?: WorldOverview | null;
  worldMap: WorldMapState | null;
  dialogueKey: string;
  dialogueEntries: StageDialogueEntry[];
  attackFeedback: CharacterAttackFeedbackEvent | null;
  actionMenuEntityId?: string | null;
  isLoading: boolean;
  isWorldMapLoading: boolean;
  isNavigationDisabled: boolean;
  inventory: PlayerInventory | null;
  isInventoryOpen: boolean;
  isInventoryLoading: boolean;
  isInventoryDisabled: boolean;
  actionComposer?: ReactNode;
  onEnterScene: (sceneId: string) => void;
  onInventoryOpenChange: (open: boolean) => void;
  onExecuteInventoryAction: (action: InventoryAction) => void | Promise<void>;
  onCloseEntityActions?: () => void;
  onOpenEntityActions?: (target: WorldActionMenuTarget) => void;
}

interface ItemTargetingState {
  action: InventoryAction;
  item: InventoryItem;
}

interface ItemTargetingPointer {
  left: number;
  top: number;
}

export function GameStageCanvas({
  stage,
  world = null,
  worldMap,
  dialogueKey,
  dialogueEntries,
  attackFeedback,
  actionMenuEntityId = null,
  isLoading,
  isWorldMapLoading,
  isNavigationDisabled,
  inventory,
  isInventoryOpen,
  isInventoryLoading,
  isInventoryDisabled,
  actionComposer,
  onEnterScene,
  onInventoryOpenChange,
  onExecuteInventoryAction,
  onCloseEntityActions,
  onOpenEntityActions,
}: GameStageCanvasProps) {
  const sceneName = stage?.scene?.name || '未知场景';
  const sceneDescription = stage?.scene?.description || '当前场景还没有可用描述。';
  const stageCharacters = useMemo(() => stage?.characters || [], [stage?.characters]);
  const dialogue = useStageDialogue(
    dialogueKey,
    dialogueEntries,
    sceneDescription,
    actionComposer ? DIALOGUE_LINES_WITH_COMPOSER : DIALOGUE_LINES_WITHOUT_COMPOSER,
    !isInventoryOpen,
  );
  const activeSpeakerId = dialogue.activeEntry.speakerId;
  const visibleCharacters = useMemo(
    () => getVisibleStageCharacters(stageCharacters, activeSpeakerId, attackFeedback?.targetEntityId),
    [activeSpeakerId, attackFeedback?.targetEntityId, stageCharacters],
  );
  const healthFeedback = useCharacterHealthFeedback(
    `${dialogueKey}:${stage?.scene?.id ?? 'scene'}`,
    visibleCharacters,
  );
  const hiddenCharacterCount = Math.max(0, stageCharacters.length - visibleCharacters.length);
  const [alphaHoveredEntityId, setAlphaHoveredEntityId] = useState<string | null>(null);
  const [itemTargeting, setItemTargeting] = useState<ItemTargetingState | null>(null);
  const [itemTargetingPointer, setItemTargetingPointer] = useState<ItemTargetingPointer | null>(null);
  const [itemTargetingNotice, setItemTargetingNotice] = useState<string | null>(null);
  const alphaHoveredEntityIdRef = useRef<string | null>(null);
  const visibleNpcTargetIds = useMemo(
    () => visibleCharacters.map((character) => character.entityId),
    [visibleCharacters],
  );
  const currentItemTargetingAction = useMemo(() => {
    if (!itemTargeting || !inventory) return null;
    const currentItem = inventory.items.find((item) => item.id === itemTargeting.item.id);
    return currentItem?.actions.find((action) => action.id === itemTargeting.action.id) || null;
  }, [inventory, itemTargeting]);
  const itemTargetIdSet = useMemo(() => {
    if (!currentItemTargetingAction) return new Set<string>();
    const visibleNpcTargetIdSet = new Set(visibleNpcTargetIds);
    return new Set(currentItemTargetingAction.validTargetIds.filter((targetId) => visibleNpcTargetIdSet.has(targetId)));
  }, [currentItemTargetingAction, visibleNpcTargetIds]);
  const {
    frameRef,
    stageScale,
    isFullscreen,
    isFullscreenSupported,
    toggleFullscreen,
  } = useGameStageScale();
  const fullscreenLabel = isFullscreenSupported
    ? (isFullscreen ? '退出全屏' : '进入全屏')
    : '当前浏览器不支持全屏';

  useEffect(() => {
    if (
      alphaHoveredEntityId
      && !visibleCharacters.some((character) => character.entityId === alphaHoveredEntityId)
    ) {
      alphaHoveredEntityIdRef.current = null;
      setAlphaHoveredEntityId(null);
    }
  }, [alphaHoveredEntityId, visibleCharacters]);

  useEffect(() => {
    if (!itemTargeting) return;
    if (
      isInventoryOpen
      && !isInventoryDisabled
      && currentItemTargetingAction
      && currentItemTargetingAction.requiresTarget
      && !currentItemTargetingAction.disabledReason
      && itemTargetIdSet.size
    ) return;
    if (isInventoryOpen && !isInventoryDisabled) {
      setItemTargetingNotice('目标状态已经变化，请重新选择道具。');
    }
    setItemTargeting(null);
    setItemTargetingPointer(null);
  }, [currentItemTargetingAction, isInventoryDisabled, isInventoryOpen, itemTargetIdSet, itemTargeting]);

  useEffect(() => {
    if (!itemTargetingNotice) return;
    const timer = window.setTimeout(() => setItemTargetingNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [itemTargetingNotice]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable);
      if (event.key === 'Escape' && itemTargeting) {
        event.preventDefault();
        setItemTargeting(null);
        setItemTargetingPointer(null);
        return;
      }
      if (event.key === 'Escape' && isInventoryOpen) {
        onInventoryOpenChange(false);
        return;
      }
      if (!isTyping && !event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'b') {
        setItemTargeting(null);
        setItemTargetingPointer(null);
        onInventoryOpenChange(!isInventoryOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInventoryOpen, itemTargeting, onInventoryOpenChange]);

  function updateAlphaHoveredEntity(entityId: string | null) {
    if (alphaHoveredEntityIdRef.current === entityId) return;
    alphaHoveredEntityIdRef.current = entityId;
    setAlphaHoveredEntityId(entityId);
  }

  function cancelItemTargeting() {
    setItemTargeting(null);
    setItemTargetingPointer(null);
  }

  function beginItemTargeting(action: InventoryAction, item: InventoryItem) {
    if (!action.requiresTarget || !action.validTargetIds.some((targetId) => visibleNpcTargetIds.includes(targetId))) {
      return;
    }
    onCloseEntityActions?.();
    setItemTargetingNotice(null);
    setAlphaHoveredEntityId(null);
    alphaHoveredEntityIdRef.current = null;
    setItemTargeting({ action, item });
    setItemTargetingPointer(null);
  }

  function executeItemOnTarget(targetId: string) {
    if (!currentItemTargetingAction || !itemTargetIdSet.has(targetId)) return;
    const action = { ...currentItemTargetingAction, targetId };
    cancelItemTargeting();
    void onExecuteInventoryAction(action);
  }

  function updateItemTargetingPointer(event: ReactPointerEvent<HTMLElement>) {
    if (!itemTargeting || event.pointerType === 'touch') return;
    const stageElement = event.currentTarget;
    const bounds = stageElement.getBoundingClientRect();
    const scaleX = bounds.width / stageElement.offsetWidth || 1;
    const scaleY = bounds.height / stageElement.offsetHeight || 1;
    setItemTargetingPointer({
      left: (event.clientX - bounds.left) / scaleX,
      top: (event.clientY - bounds.top) / scaleY,
    });
  }

  return (
    <div className="game-stage-frame" ref={frameRef}>
      <div
        className="game-stage-shell"
        style={{
          '--game-stage-scale': stageScale,
          width: GAME_STAGE_BASE_WIDTH * stageScale,
          height: GAME_STAGE_BASE_HEIGHT * stageScale,
        } as CSSProperties}
      >
        <button
          className="game-stage-fullscreen"
          type="button"
          aria-label={fullscreenLabel}
          aria-pressed={isFullscreen}
          disabled={!isFullscreenSupported}
          title={fullscreenLabel}
          onClick={() => void toggleFullscreen()}
        >
          {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
        <section
          className={[
            'game-stage',
            stage?.backgroundUrl ? 'has-background' : '',
            actionComposer ? 'has-action-composer' : '',
            itemTargeting ? 'item-targeting-active' : '',
          ].filter(Boolean).join(' ')}
          aria-label="游戏表现层"
          onContextMenu={itemTargeting ? (event) => {
            event.preventDefault();
            cancelItemTargeting();
          } : undefined}
          onPointerLeave={itemTargeting ? () => setItemTargetingPointer(null) : undefined}
          onPointerMove={itemTargeting ? updateItemTargetingPointer : undefined}
        >
          {stage?.backgroundUrl ? (
            <img className="game-stage-background" src={stage.backgroundUrl} alt="" aria-hidden="true" />
          ) : (
            <div className="game-stage-fallback" aria-hidden="true" />
          )}

          <div className="game-stage-overlay" />

          {itemTargeting ? (
            <div className="item-targeting-banner" role="status" aria-live="polite">
              <span className="item-targeting-banner-icon"><FlaskConical size={18} /></span>
              <span>
                <strong>正在使用 {itemTargeting.item.name}</strong>
                <small>点击发光的 NPC 立绘进行使用</small>
              </span>
              <kbd>Esc 取消</kbd>
            </div>
          ) : null}

          {!itemTargeting && itemTargetingNotice ? (
            <div className="item-targeting-banner item-targeting-notice" role="status" aria-live="polite">
              <span className="item-targeting-banner-icon"><Crosshair size={18} /></span>
              <span>
                <strong>{itemTargetingNotice}</strong>
                <small>当前没有可继续使用的 NPC 目标</small>
              </span>
            </div>
          ) : null}

          {itemTargeting && itemTargetingPointer ? (
            <span
              className="item-targeting-cursor"
              style={{ left: itemTargetingPointer.left, top: itemTargetingPointer.top }}
              aria-hidden="true"
            >
              <Crosshair size={31} />
              <FlaskConical size={13} />
            </span>
          ) : null}

          <header className="game-stage-header">
            <div className="game-stage-heading">
              <MapPinned size={17} />
              <strong>{sceneName}</strong>
              {world?.time ? (
                <span className="game-stage-time">
                  <Clock3 size={14} />
                  {world.time.clock.fullLabel}
                </span>
              ) : null}
            </div>
            {isLoading ? (
              <span className="game-stage-loading">
                <Loader2 className="spin" size={15} />
                更新中
              </span>
            ) : null}
          </header>

          <SceneMiniMap
            worldMap={worldMap}
            isLoading={isWorldMapLoading}
            isNavigationDisabled={isNavigationDisabled}
            isInteractive
            onEnterScene={onEnterScene}
          />

          <div className="game-character-layer" aria-label="当前场景人物">
            {visibleCharacters.map((character) => (
              <GameStageCharacter
                key={character.entityId}
                character={character}
                attackFeedbackEvent={attackFeedback?.targetEntityId === character.entityId ? attackFeedback : undefined}
                healthChangeEvent={healthFeedback.eventsByEntity[character.entityId]}
                isSpeaking={character.entityId === dialogue.activeEntry.speakerId}
                isPixelHovered={character.entityId === alphaHoveredEntityId}
                isActionMenuOpen={!itemTargeting && character.entityId === actionMenuEntityId}
                isItemTargeting={Boolean(itemTargeting)}
                isValidItemTarget={itemTargetIdSet.has(character.entityId)}
                onAlphaHoverChange={updateAlphaHoveredEntity}
                onItemTarget={executeItemOnTarget}
                onCancelItemTargeting={cancelItemTargeting}
                onOpenEntityActions={onOpenEntityActions}
              />
            ))}
          </div>

          <span className="game-stage-health-announcement" aria-live="polite" aria-atomic="true">
            {healthFeedback.announcement ? (
              <span key={healthFeedback.announcement.id}>{healthFeedback.announcement.text}</span>
            ) : null}
          </span>

          <span className="game-stage-attack-announcement" aria-live="polite" aria-atomic="true">
            {attackFeedback ? (
              <span key={attackFeedback.id}>
                {attackFeedback.hit
                  ? `攻击命中${attackFeedback.targetName}`
                  : `${attackFeedback.targetName}闪开了攻击，未命中`}
              </span>
            ) : null}
          </span>

          {!visibleCharacters.length ? (
            <div className="game-stage-empty">
              <ImageOff size={20} />
              <span>当前场景暂无可显示立绘</span>
            </div>
          ) : null}

          {hiddenCharacterCount > 0 ? (
            <div className="game-stage-overflow" aria-label={`还有 ${hiddenCharacterCount} 名人物未显示`}>
              +{hiddenCharacterCount}
            </div>
          ) : null}

          <div className={`game-stage-interaction-stack ${actionComposer ? 'has-action-composer' : ''}`}>
            <div className={`stage-dialogue-box ${isInventoryOpen ? 'narration inventory-tab' : dialogue.activeEntry.kind}`}>
              <div className="stage-output-tabs" role="tablist" aria-label="输出框页签">
                <button
                  id="stage-story-tab"
                  type="button"
                  role="tab"
                  aria-controls="stage-story-panel"
                  aria-selected={!isInventoryOpen}
                  className={!isInventoryOpen ? 'active' : ''}
                  onClick={() => {
                    cancelItemTargeting();
                    onInventoryOpenChange(false);
                  }}
                >
                  <BookOpenText size={15} />剧情
                </button>
                <button
                  id="stage-inventory-tab"
                  type="button"
                  role="tab"
                  aria-controls="stage-inventory-panel"
                  aria-selected={isInventoryOpen}
                  className={isInventoryOpen ? 'active' : ''}
                  onClick={() => onInventoryOpenChange(true)}
                >
                  <Backpack size={15} />背包
                  <strong>{inventory?.totalQuantity || 0}</strong>
                </button>
              </div>

              {isInventoryOpen ? (
                <div id="stage-inventory-panel" role="tabpanel" aria-labelledby="stage-inventory-tab">
                  <InventoryPanel
                    inventory={inventory}
                    isLoading={isInventoryLoading}
                    isDisabled={isInventoryDisabled}
                    visibleNpcTargetIds={visibleNpcTargetIds}
                    onBeginTargeting={beginItemTargeting}
                    onExecuteAction={onExecuteInventoryAction}
                  />
                </div>
              ) : (
                <div id="stage-story-panel" role="tabpanel" aria-labelledby="stage-story-tab">
                  <div
                    className="stage-dialogue-content"
                    role="button"
                    tabIndex={0}
                    aria-label={dialogue.actionLabel}
                    onClick={dialogue.advance}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      dialogue.advance();
                    }}
                  >
                    <span className="stage-dialogue-speaker">
                      {dialogue.activeEntry.kind === 'speech'
                        ? dialogue.activeEntry.speakerName || '未知人物'
                        : '旁白'}
                    </span>
                    <StageMarkdownContent
                      containerRef={dialogue.textRef}
                      segments={dialogue.visibleSegments}
                    />
                  </div>
                  <span className="stage-dialogue-progress">
                    {dialogue.pageCount > 1 ? `${dialogue.pageIndex + 1} / ${dialogue.pageCount}` : null}
                  </span>
                  <div className="stage-dialogue-navigation" role="group" aria-label="本轮输出翻页">
                    {dialogue.pageCount > 1 ? (
                      <button
                        className="stage-dialogue-page-button"
                        type="button"
                        aria-label="上一页"
                        title="上一页"
                        disabled={!dialogue.hasPreviousPage}
                        onClick={dialogue.previous}
                      >
                        <ChevronLeft size={20} />
                      </button>
                    ) : null}
                    {dialogue.pageCount > 1 ? (
                      <button
                        className="stage-dialogue-page-button"
                        type="button"
                        aria-label={dialogue.actionLabel}
                        title={dialogue.actionLabel}
                        disabled={!dialogue.canUseForwardControl}
                        onClick={dialogue.advance}
                      >
                        {dialogue.isWaiting ? (
                          <Loader2 className="spin" size={20} />
                        ) : (
                          <ChevronRight size={20} />
                        )}
                      </button>
                    ) : null}
                    {dialogue.pageCount === 1 && dialogue.isWaiting ? (
                      <span className="stage-dialogue-indicator" aria-label="正在等待后续文字">
                        <Loader2 className="spin" size={20} />
                      </span>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            {actionComposer ? (
              <div className="game-stage-action-slot">
                {actionComposer}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function useStageDialogue(
  dialogueKey: string,
  entries: StageDialogueEntry[],
  fallbackText: string,
  linesPerPage: number,
  isTextVisible: boolean,
) {
  const sequenceKey = `${dialogueKey}:${entries[0]?.runId ?? entries[0]?.id ?? 'scene'}`;
  const [pageIndex, setPageIndex] = useState(0);
  const [revealedLength, setRevealedLength] = useState(0);
  const pageLengthRef = useRef(0);
  const activePageIsStreamingRef = useRef(false);
  const revealedPageIdsRef = useRef(new Set<string>());
  const textRef = useRef<HTMLDivElement>(null);
  const [textMetrics, setTextMetrics] = useState<DialogueTextMetrics | null>(null);

  useLayoutEffect(() => {
    setPageIndex(0);
    setRevealedLength(0);
    revealedPageIdsRef.current.clear();
  }, [sequenceKey]);

  const fallbackEntry = useMemo<StageDialogueEntry>(() => ({
    id: `${dialogueKey}-scene`,
    kind: 'narration',
    content: fallbackText,
    status: 'complete',
  }), [dialogueKey, fallbackText]);
  const activeEntries = useMemo(
    () => entries.length ? entries : [fallbackEntry],
    [entries, fallbackEntry],
  );
  const paginator = useMemo(
    () => textMetrics ? createDialoguePaginator(textMetrics, linesPerPage) : null,
    [linesPerPage, sequenceKey, textMetrics],
  );
  const pages = useMemo(
    () => activeEntries.flatMap((entry) => {
      const entryPages = paginator?.paginate(entry.id, entry.content) || [createMarkdownPage(parseStageMarkdown(entry.content))];
      return entryPages.map((page, entryPageIndex) => ({
        id: `${entry.id}:${entryPageIndex}`,
        entry,
        ...page,
      }));
    }),
    [activeEntries, paginator],
  );
  const safePageIndex = Math.min(pageIndex, pages.length - 1);
  const activePage = pages[safePageIndex];
  const activeEntry = activePage?.entry || fallbackEntry;
  const pageSegments = activePage?.segments || [];
  const pageLength = activePage?.characterCount || 0;
  const visibleSegments = useMemo(
    () => sliceStageMarkdownSegments(pageSegments, revealedLength),
    [pageSegments, revealedLength],
  );
  const isPageRevealed = revealedLength >= pageLength;
  const hasPreviousPage = safePageIndex > 0;
  const hasNextPage = safePageIndex < pages.length - 1;
  const canAdvance = isPageRevealed && hasNextPage;
  const canUseForwardControl = !isPageRevealed || hasNextPage;
  const isWaiting = isPageRevealed && !canAdvance && activeEntry.status === 'streaming';

  pageLengthRef.current = pageLength;
  activePageIsStreamingRef.current = activeEntry.status === 'streaming' && !hasNextPage;

  useLayoutEffect(() => {
    if (!isTextVisible) return;
    const textElement = textRef.current;
    if (!textElement) return;

    const measure = () => {
      const fonts = readStageMarkdownFonts(textElement);
      const nextMetrics = {
        lineWidth: Math.max(120, textElement.clientWidth - 2),
        fonts,
        signature: Object.values(fonts).join('|'),
      };
      setTextMetrics((current) => (
        current?.lineWidth === nextMetrics.lineWidth && current.signature === nextMetrics.signature
          ? current
          : nextMetrics
      ));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(textElement);
    measure();
    return () => observer.disconnect();
  }, [isTextVisible]);

  useEffect(() => {
    const activePageId = activePage?.id;
    const wasRevealed = activePageId ? revealedPageIdsRef.current.has(activePageId) : false;
    setRevealedLength(wasRevealed ? pageLengthRef.current : 0);
    if (wasRevealed && !activePageIsStreamingRef.current) return;

    const timer = window.setInterval(() => {
      setRevealedLength((current) => {
        const next = Math.min(current + 1, pageLengthRef.current);
        if (next >= pageLengthRef.current && !activePageIsStreamingRef.current) {
          window.clearInterval(timer);
        }
        return next;
      });
    }, TYPEWRITER_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activePage?.id]);

  useEffect(() => {
    if (isPageRevealed && activePage?.id) {
      revealedPageIdsRef.current.add(activePage.id);
    }
  }, [activePage?.id, isPageRevealed]);

  function advance() {
    if (!isPageRevealed) {
      setRevealedLength(pageLength);
      return;
    }
    if (hasNextPage) {
      navigateToPage(safePageIndex + 1);
    }
  }

  function previous() {
    if (!hasPreviousPage) return;
    navigateToPage(safePageIndex - 1);
  }

  function navigateToPage(nextPageIndex: number) {
    const nextPage = pages[nextPageIndex];
    if (!nextPage) return;
    const wasRevealed = revealedPageIdsRef.current.has(nextPage.id);
    setRevealedLength(wasRevealed ? nextPage.characterCount : 0);
    setPageIndex(nextPageIndex);
  }

  return {
    activeEntry,
    visibleSegments,
    pageIndex: safePageIndex,
    pageCount: pages.length,
    hasPreviousPage,
    canAdvance,
    canUseForwardControl,
    isWaiting,
    advance,
    previous,
    actionLabel: !isPageRevealed
      ? '显示当前页全部文字'
      : canAdvance
        ? '显示下一页文字'
        : activeEntry.status === 'streaming'
          ? '正在等待后续文字'
          : '当前对话已结束',
    textRef,
  };
}

interface DialogueTextMetrics {
  lineWidth: number;
  fonts: Record<StageMarkdownFontName, string>;
  signature: string;
}

type StageMarkdownFontName = 'base' | 'strong' | 'emphasis' | 'strongEmphasis' | 'code';

interface DialogueMarkdownPage {
  segments: StageMarkdownSegment[];
  characterCount: number;
}

interface DialoguePaginationCacheEntry {
  source: string;
  pages: DialogueMarkdownPage[];
}

function createDialoguePaginator(metrics: DialogueTextMetrics, linesPerPage: number) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const widthCache = new Map<string, number>();
  const entryCache = new Map<string, DialoguePaginationCacheEntry>();

  function measureCharacter(character: string, marks: StageMarkdownMark[]) {
    const font = selectStageMarkdownFont(metrics.fonts, marks);
    const cacheKey = `${font}\u0000${character}`;
    const cached = widthCache.get(cacheKey);
    if (cached !== undefined) return cached;
    if (context) context.font = font;
    const width = context?.measureText(character).width || 0;
    widthCache.set(cacheKey, width);
    return width;
  }

  function paginateSegments(segments: StageMarkdownSegment[]) {
    const pages: DialogueMarkdownPage[] = [];
    let pageSegments: StageMarkdownSegment[] = [];
    let lineCount = 1;
    let currentWidth = 0;

    const finishPage = () => {
      trimPageTrailingWhitespace(pageSegments);
      if (countStageMarkdownCharacters(pageSegments) > 0) {
        pages.push(createMarkdownPage(pageSegments));
      }
      pageSegments = [];
      lineCount = 1;
      currentWidth = 0;
    };

    for (const segment of segments) {
      for (const character of Array.from(segment.text)) {
        if (character === '\n') {
          if (lineCount >= linesPerPage) finishPage();
          else {
            appendPageText(pageSegments, '\n', []);
            lineCount += 1;
            currentWidth = 0;
          }
          continue;
        }

        const characterWidth = measureCharacter(character, segment.marks);
        if (currentWidth > 0 && currentWidth + characterWidth > metrics.lineWidth) {
          if (lineCount >= linesPerPage) finishPage();
          else {
            appendPageText(pageSegments, '\n', []);
            lineCount += 1;
            currentWidth = 0;
          }
        }

        if (currentWidth === 0 && /^\s$/u.test(character) && !segment.marks.includes('code')) {
          continue;
        }
        appendPageText(pageSegments, character, segment.marks);
        currentWidth += characterWidth;
      }
    }

    finishPage();
    return pages.length ? pages : [createMarkdownPage([])];
  }

  return {
    paginate(entryId: string, content: string) {
      const normalized = content.replace(/\r\n?/g, '\n');
      const cached = entryCache.get(entryId);
      if (cached?.source === normalized) return cached.pages;
      const pages = paginateSegments(parseStageMarkdown(normalized));
      entryCache.set(entryId, { source: normalized, pages });
      return pages;
    },
  };
}

function createMarkdownPage(segments: StageMarkdownSegment[]): DialogueMarkdownPage {
  return {
    segments: segments.map((segment) => ({ ...segment, marks: [...segment.marks] })),
    characterCount: countStageMarkdownCharacters(segments),
  };
}

function appendPageText(
  segments: StageMarkdownSegment[],
  text: string,
  marks: StageMarkdownMark[],
) {
  const previous = segments[segments.length - 1];
  if (previous && sameStageMarkdownMarks(previous.marks, marks)) {
    previous.text += text;
    return;
  }
  segments.push({ text, marks: [...marks] });
}

function trimPageTrailingWhitespace(segments: StageMarkdownSegment[]) {
  while (segments.length) {
    const last = segments[segments.length - 1];
    last.text = last.text.replace(/\s+$/u, '');
    if (last.text) return;
    segments.pop();
  }
}

function sameStageMarkdownMarks(left: StageMarkdownMark[], right: StageMarkdownMark[]) {
  return left.length === right.length && left.every((mark, index) => mark === right[index]);
}

function selectStageMarkdownFont(
  fonts: Record<StageMarkdownFontName, string>,
  marks: StageMarkdownMark[],
) {
  if (marks.includes('code')) return fonts.code;
  const isStrong = marks.includes('strong') || marks.includes('heading');
  const isEmphasis = marks.includes('emphasis') || marks.includes('image');
  if (isStrong && isEmphasis) return fonts.strongEmphasis;
  if (isStrong) return fonts.strong;
  if (isEmphasis) return fonts.emphasis;
  return fonts.base;
}

function readStageMarkdownFonts(container: HTMLDivElement) {
  return {
    base: readStageMarkdownFont(container),
    strong: readStageMarkdownFont(container, ['strong']),
    emphasis: readStageMarkdownFont(container, ['emphasis']),
    strongEmphasis: readStageMarkdownFont(container, ['strong', 'emphasis']),
    code: readStageMarkdownFont(container, ['code']),
  } satisfies Record<StageMarkdownFontName, string>;
}

function readStageMarkdownFont(container: HTMLDivElement, marks: StageMarkdownMark[] = []) {
  if (!marks.length) return formatCanvasFont(getComputedStyle(container));
  const probe = document.createElement('span');
  probe.className = marks.map((mark) => `stage-markdown-${mark}`).join(' ');
  probe.textContent = '测';
  probe.setAttribute('aria-hidden', 'true');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  container.appendChild(probe);
  const font = formatCanvasFont(getComputedStyle(probe));
  probe.remove();
  return font;
}

function formatCanvasFont(styles: CSSStyleDeclaration) {
  return `${styles.fontStyle} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
}

function useGameStageScale() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [stageScale, setStageScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isFullscreenSupported = typeof document !== 'undefined'
    && typeof document.documentElement.requestFullscreen === 'function'
    && typeof document.exitFullscreen === 'function';

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    let animationFrame = 0;
    const measure = () => {
      const frameStyles = getComputedStyle(frame);
      const paddingX = parseCssPx(frameStyles.paddingLeft) + parseCssPx(frameStyles.paddingRight);
      const paddingY = parseCssPx(frameStyles.paddingTop) + parseCssPx(frameStyles.paddingBottom);
      const gameViewStyles = getComputedStyle(frame.closest('.game-view') || frame);
      const chatMinHeight = readCssPx(gameViewStyles, '--game-stage-chat-min-height');
      const frameTop = frame.getBoundingClientRect().top;
      const widthBudget = Math.max(0, frame.clientWidth - paddingX);
      const frameIsFullscreen = document.fullscreenElement === frame;
      const heightBudget = frameIsFullscreen
        ? Math.max(0, frame.clientHeight - paddingY)
        : Math.max(0, window.innerHeight - frameTop - chatMinHeight - paddingY);
      const maximumScale = frameIsFullscreen ? Number.POSITIVE_INFINITY : 1;
      const nextScale = clamp(
        Math.min(maximumScale, widthBudget / GAME_STAGE_BASE_WIDTH, heightBudget / GAME_STAGE_BASE_HEIGHT),
        GAME_STAGE_MIN_SCALE,
        maximumScale,
      );

      setStageScale((currentScale) => (
        Math.abs(currentScale - nextScale) > 0.001 ? nextScale : currentScale
      ));
    };
    const scheduleMeasure = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(measure);
    };
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === frame);
      scheduleMeasure();
    };

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(frame);
    window.addEventListener('resize', scheduleMeasure);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    setIsFullscreen(document.fullscreenElement === frame);
    measure();

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  async function toggleFullscreen() {
    const frame = frameRef.current;
    if (!frame || !isFullscreenSupported) return;

    try {
      if (document.fullscreenElement === frame) {
        await document.exitFullscreen();
      } else if (!document.fullscreenElement) {
        await frame.requestFullscreen();
      }
    } catch {
      // A browser or host window can reject fullscreen without changing the stage state.
    }
  }

  return { frameRef, stageScale, isFullscreen, isFullscreenSupported, toggleFullscreen };
}

function readCssPx(styles: CSSStyleDeclaration, propertyName: string) {
  return parseCssPx(styles.getPropertyValue(propertyName));
}

function parseCssPx(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
