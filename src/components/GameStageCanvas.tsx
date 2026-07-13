import {
  ChevronUp,
  Clock3,
  Compass,
  ImageOff,
  Loader2,
  MapPinned,
  Maximize2,
  Minimize2,
  ScrollText,
  Send,
  Shield,
  UserRound,
} from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import type {
  PresentationStage,
  PresentationStageCharacter,
  StageNarration,
  StageSpeech,
  WorldMapState,
  WorldOverview,
} from '../types';
import type { StageLogEntry } from '../lib/stageSync';
import { SceneMiniMap } from './SceneMiniMap';

const STAGE_SPEECH_MAX_LENGTH = 100;
const GAME_STAGE_BASE_WIDTH = 1280;
const GAME_STAGE_BASE_HEIGHT = 720;
const GAME_STAGE_MIN_SCALE = 0.3;
const STAGE_SLOTS = {
  1: ['center'],
  2: ['left', 'right'],
  3: ['left', 'center', 'right'],
} as const;

interface GameStageCanvasProps {
  variant?: 'presentation' | 'playable';
  stage: PresentationStage | null;
  world?: WorldOverview | null;
  worldMap: WorldMapState | null;
  activeStageSpeech: StageSpeech | null;
  activeStageNarration: StageNarration | null;
  recentLogEntries?: StageLogEntry[];
  isActionPending?: boolean;
  isMainAppConnected?: boolean;
  canSubmitActions?: boolean;
  actionStatusLabel?: string;
  isLoading: boolean;
  isWorldMapLoading: boolean;
  isNavigationDisabled: boolean;
  isMapInteractive?: boolean;
  onSubmitAction?: (content: string) => void;
  onEnterScene: (sceneId: string) => void;
}

export function GameStageCanvas({
  variant = 'presentation',
  stage,
  world = null,
  worldMap,
  activeStageSpeech,
  activeStageNarration,
  recentLogEntries = [],
  isActionPending = false,
  isMainAppConnected = true,
  canSubmitActions,
  actionStatusLabel,
  isLoading,
  isWorldMapLoading,
  isNavigationDisabled,
  isMapInteractive = true,
  onSubmitAction,
  onEnterScene,
}: GameStageCanvasProps) {
  const sceneName = stage?.scene?.name || '未知场景';
  const sceneDescription = stage?.scene?.description || '当前场景还没有可用描述。';
  const stageCharacters = stage?.characters || [];
  const visibleCharacters = getVisibleCharacters(stageCharacters, activeStageSpeech);
  const visibleSpeaker = visibleCharacters.find((character) => character.entityId === activeStageSpeech?.entityId) || null;
  const hiddenCharacterCount = Math.max(0, stageCharacters.length - visibleCharacters.length);
  const stageNarration = activeStageNarration?.content.trim() || '';
  const {
    frameRef,
    stageScale,
    isFullscreen,
    isFullscreenSupported,
    toggleFullscreen,
  } = useGameStageScale();
  const isPlayable = variant === 'playable';
  const fullscreenLabel = isFullscreenSupported
    ? (isFullscreen ? '退出全屏' : '进入全屏')
    : '当前浏览器不支持全屏';

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
        {!isPlayable ? (
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
        ) : null}
        <section className={`game-stage ${stage?.backgroundUrl ? 'has-background' : ''}`} aria-label="游戏表现层">
          {stage?.backgroundUrl ? (
            <img className="game-stage-background" src={stage.backgroundUrl} alt="" aria-hidden="true" />
          ) : (
            <div className="game-stage-fallback" aria-hidden="true" />
          )}

          <div className="game-stage-overlay" />

          {!isPlayable ? (
            <>
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
                isInteractive={isMapInteractive}
                onEnterScene={onEnterScene}
              />

              {stageNarration ? (
                <aside className="stage-narration-panel" aria-label="当前旁白">
                  <strong>
                    <ScrollText size={14} />
                    旁白
                  </strong>
                  <p>{stageNarration}</p>
                </aside>
              ) : null}
            </>
          ) : null}

          <div className="game-character-layer" aria-label="当前场景人物">
            {visibleCharacters.map((character) => (
              <figure
                className={[
                  'game-character',
                  `slot-${character.slot}`,
                  character.isFallbackPortrait ? 'fallback-character' : '',
                  character.entityId === activeStageSpeech?.entityId ? 'speaking-character' : '',
                ].filter(Boolean).join(' ')}
                key={character.entityId}
                style={{ '--character-scale': String(character.scale || 1) } as CSSProperties}
              >
                {character.portraitUrl ? <img src={character.portraitUrl} alt={character.name} /> : <div className="game-character-missing" />}
                <figcaption>{character.name}</figcaption>
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

          {!isPlayable && activeStageSpeech && visibleSpeaker ? (
            <aside
              className={`stage-speech-bubble slot-${visibleSpeaker.slot}`}
              aria-label={`${activeStageSpeech.name} 正在发言`}
            >
              <strong>{activeStageSpeech.name}</strong>
              <p>{formatStageSpeech(activeStageSpeech.content)}</p>
            </aside>
          ) : null}

          {isPlayable ? (
            <PlayableStageHud
              sceneName={sceneName}
              sceneDescription={sceneDescription}
              stageCharacters={stageCharacters}
              visibleSpeaker={visibleSpeaker}
              activeStageSpeech={activeStageSpeech}
              stageNarration={stageNarration}
              world={world}
              worldMap={worldMap}
              recentLogEntries={recentLogEntries}
              isActionPending={isActionPending}
              isMainAppConnected={isMainAppConnected}
              canSubmitActions={canSubmitActions}
              actionStatusLabel={actionStatusLabel}
              isLoading={isLoading || isWorldMapLoading}
              onSubmitAction={onSubmitAction}
            />
          ) : (
            <footer className="game-stage-footer">
              <UserRound size={16} />
              <span>{sceneDescription}</span>
            </footer>
          )}
        </section>
      </div>
    </div>
  );
}

interface PlayableStageHudProps {
  sceneName: string;
  sceneDescription: string;
  stageCharacters: PresentationStageCharacter[];
  visibleSpeaker: PresentationStageCharacter | null;
  activeStageSpeech: StageSpeech | null;
  stageNarration: string;
  world: WorldOverview | null;
  worldMap: WorldMapState | null;
  recentLogEntries: StageLogEntry[];
  isActionPending: boolean;
  isMainAppConnected: boolean;
  canSubmitActions?: boolean;
  actionStatusLabel?: string;
  isLoading: boolean;
  onSubmitAction?: (content: string) => void;
}

function PlayableStageHud({
  sceneName,
  sceneDescription,
  stageCharacters,
  visibleSpeaker,
  activeStageSpeech,
  stageNarration,
  world,
  worldMap,
  recentLogEntries,
  isActionPending,
  isMainAppConnected,
  canSubmitActions,
  actionStatusLabel,
  isLoading,
  onSubmitAction,
}: PlayableStageHudProps) {
  const [input, setInput] = useState('');
  const primaryCharacter = visibleSpeaker || stageCharacters[0] || null;
  const currentScene = world?.currentScene;
  const exits = currentScene?.exits || [];
  const residents = currentScene?.residents || [];
  const items = currentScene?.items || [];
  const relatedLore = currentScene?.relatedLore || [];
  const canSubmit = Boolean(onSubmitAction && (canSubmitActions ?? isMainAppConnected) && !isActionPending);
  const statusLabel = actionStatusLabel || (isMainAppConnected ? '已连接' : '展示模式');

  function submitAction(content: string) {
    const trimmed = content.trim();
    if (!trimmed || !canSubmit) return;
    onSubmitAction?.(trimmed);
    setInput('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitAction(input);
  }

  return (
    <div className="playable-stage-hud">
      {activeStageSpeech ? (
        <aside
          className={`hud-speech-card ${visibleSpeaker ? `slot-${visibleSpeaker.slot}` : ''}`}
          aria-label={`${activeStageSpeech.name} 正在发言`}
        >
          <strong>{activeStageSpeech.name}</strong>
          <p>{formatStageSpeech(activeStageSpeech.content || '……')}</p>
        </aside>
      ) : null}

      <aside className="hud-right-stack" aria-label="世界状态">
        <section className="hud-map-panel hud-panel">
          <header>
            <Compass size={15} />
            <strong>{sceneName}</strong>
            {world?.time ? <span>{world.time.clock.fullLabel}</span> : null}
          </header>
          <StageHudMap worldMap={worldMap} />
        </section>

        <section className="hud-status-panel hud-panel">
          <header>
            <Shield size={15} />
            <strong>状态</strong>
            <span>{statusLabel}</span>
          </header>
          <dl>
            <div><dt>人物</dt><dd>{residents.length}</dd></div>
            <div><dt>道具</dt><dd>{items.length}</dd></div>
            <div><dt>出口</dt><dd>{exits.length}</dd></div>
            <div><dt>线索</dt><dd>{relatedLore.length}</dd></div>
          </dl>
        </section>

        <section className="hud-log-panel hud-panel">
          <header>
            <ScrollText size={15} />
            <strong>近期记录</strong>
            <ChevronUp size={14} />
          </header>
          <ol>
            {(recentLogEntries.length ? recentLogEntries : [{ id: 'empty', role: 'dm' as const, text: '等待新的行动。' }]).slice(-4).map((entry) => (
              <li key={entry.id}>
                <span>{entry.role === 'player' ? '你' : entry.role === 'npc' ? 'NPC' : entry.role === 'system' ? '系统' : 'DM'}</span>
                <p>{entry.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </aside>

      <section className="hud-bottom-bar" aria-label="玩家输入">
        <aside className="hud-dm-card hud-panel">
          <header>
            <ScrollText size={15} />
            <strong>DM 叙述</strong>
          </header>
          <p>{stageNarration || sceneDescription}</p>
        </aside>

        <form className="hud-command-form hud-panel" onSubmit={handleSubmit}>
          <textarea
            aria-label="输入你的行动"
            disabled={!canSubmit}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submitAction(input);
              }
            }}
            placeholder={canSubmitActions ?? isMainAppConnected ? '你要采取什么行动？' : '打开主页面后即可发送行动'}
            value={input}
          />
          <button disabled={!canSubmit || !input.trim()} type="submit">
            {isActionPending || isLoading ? <Loader2 className="spin" size={20} /> : <Send size={20} />}
            <span>发送</span>
          </button>
          <small>{canSubmitActions ?? isMainAppConnected ? 'Enter 发送 / Shift + Enter 换行' : '当前仅展示后端舞台状态'}</small>
        </form>
      </section>
    </div>
  );
}

function StageHudMap({ worldMap }: { worldMap: WorldMapState | null }) {
  const scenes = worldMap?.scenes || [];
  const currentSceneId = worldMap?.currentSceneId || scenes[0]?.id || '';
  const currentScene = scenes.find((scene) => scene.id === currentSceneId) || scenes[0] || null;
  const visibleScenes = currentScene
    ? [currentScene, ...scenes.filter((scene) => scene.id !== currentScene.id).slice(0, 5)]
    : scenes.slice(0, 6);
  return (
    <div className="hud-map-preview">
      <svg viewBox="0 0 220 120" aria-hidden="true">
        {visibleScenes.map((scene, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(visibleScenes.length, 1) - Math.PI / 2;
          const x = index === 0 ? 110 : 110 + Math.cos(angle) * 58;
          const y = index === 0 ? 60 : 60 + Math.sin(angle) * 38;
          return (
            <g className={scene.id === currentSceneId ? 'current' : ''} key={scene.id}>
              <circle cx={x} cy={y} r={scene.id === currentSceneId ? 7 : 4} />
            </g>
          );
        })}
      </svg>
      <span>{currentScene?.name || '未知场景'}</span>
    </div>
  );
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
      const composerHeight = readCssPx(gameViewStyles, '--game-stage-composer-height');
      const chatMinHeight = readCssPx(gameViewStyles, '--game-stage-chat-min-height');
      const frameTop = frame.getBoundingClientRect().top;
      const widthBudget = Math.max(0, frame.clientWidth - paddingX);
      const frameIsFullscreen = document.fullscreenElement === frame;
      const heightBudget = frameIsFullscreen
        ? Math.max(0, frame.clientHeight - paddingY)
        : Math.max(0, window.innerHeight - frameTop - composerHeight - chatMinHeight - paddingY);
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
  activeStageSpeech: StageSpeech | null,
): PresentationStageCharacter[] {
  const speaker = activeStageSpeech
    ? characters.find((character) => character.entityId === activeStageSpeech.entityId) || null
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

function formatStageSpeech(content: string) {
  const normalized = content.trim();
  if (normalized.length <= STAGE_SPEECH_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, STAGE_SPEECH_MAX_LENGTH)}...`;
}
