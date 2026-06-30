import { ImageOff, Loader2, MapPinned, UserRound } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Conversation, FixedContext, PresentationStage, PresentationStageCharacter, StageSpeech, WorldMapState } from '../types';
import { ChatThread } from './ChatThread';
import { SceneMiniMap } from './SceneMiniMap';

const STAGE_SPEECH_MAX_LENGTH = 100;
const STAGE_SLOTS = {
  1: ['center'],
  2: ['left', 'right'],
  3: ['left', 'center', 'right'],
} as const;

interface GameViewProps {
  stage: PresentationStage | null;
  worldMap: WorldMapState | null;
  activeStageSpeech: StageSpeech | null;
  isLoading: boolean;
  isWorldMapLoading: boolean;
  isNavigationDisabled: boolean;
  conversation: Conversation;
  error: string | null;
  fixedContext: FixedContext;
  onEnterScene: (sceneId: string) => void;
  onOpenSettings: () => void;
}

export function GameView({
  stage,
  worldMap,
  activeStageSpeech,
  isLoading,
  isWorldMapLoading,
  isNavigationDisabled,
  conversation,
  error,
  fixedContext,
  onEnterScene,
  onOpenSettings,
}: GameViewProps) {
  const sceneName = stage?.scene?.name || '未知场景';
  const sceneDescription = stage?.scene?.description || '当前场景还没有可用描述。';
  const stageCharacters = stage?.characters || [];
  const visibleCharacters = getVisibleCharacters(stageCharacters, activeStageSpeech);
  const visibleSpeaker = visibleCharacters.find((character) => character.entityId === activeStageSpeech?.entityId) || null;
  const hiddenCharacterCount = Math.max(0, stageCharacters.length - visibleCharacters.length);

  return (
    <div className="game-view">
      <section className={`game-stage ${stage?.backgroundUrl ? 'has-background' : ''}`} aria-label="游戏表现层">
        {stage?.backgroundUrl ? (
          <img className="game-stage-background" src={stage.backgroundUrl} alt="" aria-hidden="true" />
        ) : (
          <div className="game-stage-fallback" aria-hidden="true" />
        )}

        <div className="game-stage-overlay" />

        <header className="game-stage-header">
          <div>
            <MapPinned size={17} />
            <strong>{sceneName}</strong>
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
          onEnterScene={onEnterScene}
        />

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

        {activeStageSpeech && visibleSpeaker ? (
          <aside
            className={`stage-speech-bubble slot-${visibleSpeaker.slot}`}
            aria-label={`${activeStageSpeech.name} 正在发言`}
          >
            <strong>{activeStageSpeech.name}</strong>
            <p>{formatStageSpeech(activeStageSpeech.content)}</p>
          </aside>
        ) : null}

        <footer className="game-stage-footer">
          <UserRound size={16} />
          <span>{sceneDescription}</span>
        </footer>
      </section>

      <ChatThread
        conversation={conversation}
        error={error}
        fixedContext={fixedContext}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
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
    slot: character.position && character.position !== 'auto' ? character.position : slots[index] || 'center',
  }));
}

function formatStageSpeech(content: string) {
  const normalized = content.trim();
  if (normalized.length <= STAGE_SPEECH_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, STAGE_SPEECH_MAX_LENGTH)}...`;
}
