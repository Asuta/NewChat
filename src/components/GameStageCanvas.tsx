import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  ImageOff,
  Loader2,
  MapPinned,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  PresentationStage,
  PresentationStageCharacter,
  StageDialogueEntry,
  WorldActionMenuTarget,
  WorldMapState,
  WorldOverview,
} from '../types';
import { SceneMiniMap } from './SceneMiniMap';

const GAME_STAGE_BASE_WIDTH = 1280;
const GAME_STAGE_BASE_HEIGHT = 720;
const GAME_STAGE_MIN_SCALE = 0.3;
const DIALOGUE_LINES_PER_PAGE = 3;
const TYPEWRITER_INTERVAL_MS = 22;
const CHARACTER_ALPHA_MASK_MAX_SIZE = 512;
const CHARACTER_ALPHA_HIT_THRESHOLD = 16;
const STAGE_SLOTS = {
  1: ['center'],
  2: ['left', 'right'],
  3: ['left', 'center', 'right'],
} as const;

interface GameStageCanvasProps {
  stage: PresentationStage | null;
  world?: WorldOverview | null;
  worldMap: WorldMapState | null;
  dialogueKey: string;
  dialogueEntries: StageDialogueEntry[];
  actionMenuEntityId?: string | null;
  isLoading: boolean;
  isWorldMapLoading: boolean;
  isNavigationDisabled: boolean;
  actionComposer?: ReactNode;
  onEnterScene: (sceneId: string) => void;
  onOpenEntityActions?: (target: WorldActionMenuTarget) => void;
}

export function GameStageCanvas({
  stage,
  world = null,
  worldMap,
  dialogueKey,
  dialogueEntries,
  actionMenuEntityId = null,
  isLoading,
  isWorldMapLoading,
  isNavigationDisabled,
  actionComposer,
  onEnterScene,
  onOpenEntityActions,
}: GameStageCanvasProps) {
  const sceneName = stage?.scene?.name || '未知场景';
  const sceneDescription = stage?.scene?.description || '当前场景还没有可用描述。';
  const stageCharacters = stage?.characters || [];
  const dialogue = useStageDialogue(dialogueKey, dialogueEntries, sceneDescription);
  const visibleCharacters = useMemo(
    () => getVisibleCharacters(stage?.characters || [], dialogue.activeEntry.speakerId),
    [stage?.characters, dialogue.activeEntry.speakerId],
  );
  const hiddenCharacterCount = Math.max(0, stageCharacters.length - visibleCharacters.length);
  const [alphaHoveredEntityId, setAlphaHoveredEntityId] = useState<string | null>(null);
  const alphaHoveredEntityIdRef = useRef<string | null>(null);
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

  function updateAlphaHoveredEntity(entityId: string | null) {
    if (alphaHoveredEntityIdRef.current === entityId) return;
    alphaHoveredEntityIdRef.current = entityId;
    setAlphaHoveredEntityId(entityId);
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
          ].filter(Boolean).join(' ')}
          aria-label="游戏表现层"
        >
          {stage?.backgroundUrl ? (
            <img className="game-stage-background" src={stage.backgroundUrl} alt="" aria-hidden="true" />
          ) : (
            <div className="game-stage-fallback" aria-hidden="true" />
          )}

          <div className="game-stage-overlay" />

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
              <figure
                className={[
                  'game-character',
                  `slot-${character.slot}`,
                  character.isFallbackPortrait ? 'fallback-character' : '',
                  character.entityId === dialogue.activeEntry.speakerId ? 'speaking-character' : '',
                  onOpenEntityActions ? 'has-actions' : '',
                  character.entityId === alphaHoveredEntityId ? 'pixel-hovered' : '',
                  character.entityId === actionMenuEntityId ? 'action-menu-open' : '',
                ].filter(Boolean).join(' ')}
                key={character.entityId}
                style={{ '--character-scale': String(character.scale || 1) } as CSSProperties}
                onContextMenu={onOpenEntityActions ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (
                    event.target instanceof HTMLImageElement
                    && !isCharacterImagePointOpaque(event.target, event.clientX, event.clientY)
                  ) return;
                  onOpenEntityActions({
                    entityId: character.entityId,
                    entityName: character.name,
                    clientX: event.clientX,
                    clientY: event.clientY,
                  });
                } : undefined}
              >
                {character.portraitUrl ? (
                  <img
                    src={character.portraitUrl}
                    alt={character.name}
                    onLoad={(event) => prepareCharacterAlphaMask(event.currentTarget)}
                    onPointerMove={onOpenEntityActions ? (event) => {
                      if (event.pointerType === 'touch') return;
                      updateAlphaHoveredEntity(
                        isCharacterImagePointOpaque(event.currentTarget, event.clientX, event.clientY)
                          ? character.entityId
                          : null,
                      );
                    } : undefined}
                    onPointerLeave={onOpenEntityActions ? () => {
                      if (alphaHoveredEntityIdRef.current === character.entityId) {
                        updateAlphaHoveredEntity(null);
                      }
                    } : undefined}
                  />
                ) : (
                  <div className="game-character-missing" />
                )}
                <figcaption className={character.health ? 'has-health' : undefined}>
                  <span className="game-character-caption-row">
                    <span className="game-character-name">{character.name}</span>
                    {character.health ? (
                      <span className="game-character-health-value" aria-hidden="true">
                        {character.health.currentHitPoints}/{character.health.maxHitPoints}
                      </span>
                    ) : null}
                  </span>
                  {character.health ? (
                    <span
                      className="game-character-health-track"
                      role="meter"
                      aria-label={`${character.name} 生命值`}
                      aria-valuemin={0}
                      aria-valuemax={character.health.maxHitPoints}
                      aria-valuenow={character.health.currentHitPoints}
                      aria-valuetext={`${character.health.currentHitPoints}/${character.health.maxHitPoints}`}
                    >
                      <span
                        className={`game-character-health-fill ${getHealthTone(character.health.currentHitPoints, character.health.maxHitPoints)}`}
                        style={{ width: `${getHealthPercentage(character.health.currentHitPoints, character.health.maxHitPoints)}%` }}
                      />
                    </span>
                  ) : null}
                </figcaption>
              </figure>
            ))}
          </div>

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
            <div className={`stage-dialogue-box ${dialogue.activeEntry.kind}`}>
              <button
                className="stage-dialogue-content"
                type="button"
                aria-label={dialogue.actionLabel}
                onClick={dialogue.advance}
              >
                <span className="stage-dialogue-speaker">
                  {dialogue.activeEntry.kind === 'speech'
                    ? dialogue.activeEntry.speakerName || '未知人物'
                    : '旁白'}
                </span>
                <span className="stage-dialogue-text" aria-live="polite" ref={dialogue.textRef}>
                  {dialogue.visibleText || '……'}
                </span>
              </button>
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

function useStageDialogue(dialogueKey: string, entries: StageDialogueEntry[], fallbackText: string) {
  const sequenceKey = `${dialogueKey}:${entries[0]?.runId ?? entries[0]?.id ?? 'scene'}`;
  const [pageIndex, setPageIndex] = useState(0);
  const [revealedLength, setRevealedLength] = useState(0);
  const pageLengthRef = useRef(0);
  const activePageIsStreamingRef = useRef(false);
  const revealedPageIdsRef = useRef(new Set<string>());
  const textRef = useRef<HTMLSpanElement>(null);
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
    () => textMetrics ? createDialoguePaginator(textMetrics) : null,
    [sequenceKey, textMetrics],
  );
  const pages = useMemo(
    () => activeEntries.flatMap((entry) => {
      const entryPages = paginator?.paginate(entry.id, entry.content) || [entry.content.trim()];
      return entryPages.map((content, entryPageIndex) => ({
        id: `${entry.id}:${entryPageIndex}`,
        entry,
        content,
      }));
    }),
    [activeEntries, paginator],
  );
  const safePageIndex = Math.min(pageIndex, pages.length - 1);
  const activePage = pages[safePageIndex];
  const activeEntry = activePage?.entry || fallbackEntry;
  const pageText = activePage?.content || '';
  const pageCharacters = useMemo(() => Array.from(pageText), [pageText]);
  const visibleText = pageCharacters.slice(0, revealedLength).join('');
  const isPageRevealed = revealedLength >= pageCharacters.length;
  const hasPreviousPage = safePageIndex > 0;
  const hasNextPage = safePageIndex < pages.length - 1;
  const canAdvance = isPageRevealed && hasNextPage;
  const canUseForwardControl = !isPageRevealed || hasNextPage;
  const isWaiting = isPageRevealed && !canAdvance && activeEntry.status === 'streaming';

  pageLengthRef.current = pageCharacters.length;
  activePageIsStreamingRef.current = activeEntry.status === 'streaming' && !hasNextPage;

  useLayoutEffect(() => {
    const textElement = textRef.current;
    if (!textElement) return;

    const measure = () => {
      const styles = getComputedStyle(textElement);
      const nextMetrics = {
        lineWidth: Math.max(120, textElement.clientWidth - 12),
        font: `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`,
      };
      setTextMetrics((current) => (
        current?.lineWidth === nextMetrics.lineWidth && current.font === nextMetrics.font
          ? current
          : nextMetrics
      ));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(textElement);
    measure();
    return () => observer.disconnect();
  }, []);

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
      setRevealedLength(pageCharacters.length);
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
    const nextPageLength = Array.from(nextPage.content).length;
    const wasRevealed = revealedPageIdsRef.current.has(nextPage.id);
    setRevealedLength(wasRevealed ? nextPageLength : 0);
    setPageIndex(nextPageIndex);
  }

  return {
    activeEntry,
    visibleText,
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
  font: string;
}

interface DialoguePaginationState {
  source: string;
  pages: string[];
  pageLines: string[];
  currentLine: string;
  currentWidth: number;
}

function createDialoguePaginator(metrics: DialogueTextMetrics) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (context) context.font = metrics.font;
  const widthCache = new Map<string, number>();
  const entryCache = new Map<string, DialoguePaginationState>();

  function measureCharacter(character: string) {
    const cached = widthCache.get(character);
    if (cached !== undefined) return cached;
    const width = context?.measureText(character).width || 0;
    widthCache.set(character, width);
    return width;
  }

  function appendLine(state: DialoguePaginationState) {
    state.pageLines.push(state.currentLine.trimEnd());
    state.currentLine = '';
    state.currentWidth = 0;
    if (state.pageLines.length < DIALOGUE_LINES_PER_PAGE) return;
    const page = state.pageLines.join('\n').trim();
    if (page) state.pages.push(page);
    state.pageLines = [];
  }

  function appendContent(state: DialoguePaginationState, content: string) {
    for (const character of Array.from(content)) {
      if (character === '\n') {
        appendLine(state);
        continue;
      }

      const characterWidth = measureCharacter(character);
      if (state.currentLine && state.currentWidth + characterWidth > metrics.lineWidth) {
        appendLine(state);
        state.currentLine = character.trimStart();
        state.currentWidth = state.currentLine ? characterWidth : 0;
        continue;
      }
      state.currentLine += character;
      state.currentWidth += characterWidth;
    }
  }

  function createState(source: string): DialoguePaginationState {
    const state: DialoguePaginationState = {
      source: '',
      pages: [],
      pageLines: [],
      currentLine: '',
      currentWidth: 0,
    };
    appendContent(state, source);
    state.source = source;
    return state;
  }

  function getPages(state: DialoguePaginationState) {
    const activePage = [...state.pageLines, state.currentLine.trimEnd()].join('\n').trim();
    return activePage ? [...state.pages, activePage] : state.pages.length ? [...state.pages] : [''];
  }

  return {
    paginate(entryId: string, content: string) {
      const normalized = content.replace(/\r\n?/g, '\n');
      let state = entryCache.get(entryId);
      if (!state || !normalized.startsWith(state.source)) {
        state = createState(normalized);
        entryCache.set(entryId, state);
        return getPages(state);
      }
      if (normalized.length > state.source.length) {
        appendContent(state, normalized.slice(state.source.length));
        state.source = normalized;
      }
      return getPages(state);
    },
  };
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

function getVisibleCharacters(
  characters: PresentationStageCharacter[],
  activeSpeakerId?: string,
): PresentationStageCharacter[] {
  const speaker = activeSpeakerId
    ? characters.find((character) => character.entityId === activeSpeakerId) || null
    : null;
  const firstThree = characters.slice(0, 3);
  const selected = speaker && !firstThree.some((character) => character.entityId === speaker.entityId)
    ? [...characters.filter((character) => character.entityId !== speaker.entityId).slice(0, 2), speaker]
    : firstThree;

  const slots = STAGE_SLOTS[Math.min(selected.length, 3) as keyof typeof STAGE_SLOTS] || STAGE_SLOTS[1];
  return selected.map((character, index) => ({
    ...character,
    slot: selected.length === 1 && character.position && character.position !== 'auto'
      ? character.position
      : slots[index] || 'center',
  }));
}
function getHealthPercentage(currentHitPoints: number, maxHitPoints: number) {
  return clamp((currentHitPoints / maxHitPoints) * 100, 0, 100);
}

function getHealthTone(currentHitPoints: number, maxHitPoints: number) {
  const ratio = currentHitPoints / maxHitPoints;
  if (ratio <= 0.25) return 'is-critical';
  if (ratio <= 0.5) return 'is-wounded';
  return 'is-healthy';
}

interface CharacterAlphaMask {
  width: number;
  height: number;
  alpha: Uint8Array;
}

interface CharacterAlphaMaskCacheEntry {
  source: string;
  mask: CharacterAlphaMask | null;
}

const characterAlphaMaskCache = new WeakMap<HTMLImageElement, CharacterAlphaMaskCacheEntry>();

function prepareCharacterAlphaMask(image: HTMLImageElement) {
  const source = image.currentSrc || image.src;
  const cached = characterAlphaMaskCache.get(image);
  if (cached?.source === source || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;

  const scale = Math.min(1, CHARACTER_ALPHA_MASK_MAX_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    characterAlphaMaskCache.set(image, { source, mask: null });
    return;
  }

  try {
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const alpha = new Uint8Array(width * height);
    for (let sourceIndex = 3, alphaIndex = 0; sourceIndex < pixels.length; sourceIndex += 4, alphaIndex += 1) {
      alpha[alphaIndex] = pixels[sourceIndex];
    }
    characterAlphaMaskCache.set(image, { source, mask: { width, height, alpha } });
  } catch {
    // Preserve the old rectangular interaction if a cross-origin image cannot be sampled.
    characterAlphaMaskCache.set(image, { source, mask: null });
  }
}

function isCharacterImagePointOpaque(image: HTMLImageElement, clientX: number, clientY: number) {
  prepareCharacterAlphaMask(image);
  const entry = characterAlphaMaskCache.get(image);
  if (!entry?.mask) return true;

  const bounds = image.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return false;
  const relativeX = (clientX - bounds.left) / bounds.width;
  const relativeY = (clientY - bounds.top) / bounds.height;
  if (relativeX < 0 || relativeX >= 1 || relativeY < 0 || relativeY >= 1) return false;

  const x = Math.min(entry.mask.width - 1, Math.floor(relativeX * entry.mask.width));
  const y = Math.min(entry.mask.height - 1, Math.floor(relativeY * entry.mask.height));
  return entry.mask.alpha[y * entry.mask.width + x] >= CHARACTER_ALPHA_HIT_THRESHOLD;
}
