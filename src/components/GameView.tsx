import { ImageOff, Loader2, MapPinned, UserRound } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Conversation, FixedContext, PresentationStage } from '../types';
import { ChatThread } from './ChatThread';

interface GameViewProps {
  stage: PresentationStage | null;
  isLoading: boolean;
  conversation: Conversation;
  error: string | null;
  fixedContext: FixedContext;
  onOpenSettings: () => void;
}

export function GameView({
  stage,
  isLoading,
  conversation,
  error,
  fixedContext,
  onOpenSettings,
}: GameViewProps) {
  const sceneName = stage?.scene?.name || '未知场景';
  const sceneDescription = stage?.scene?.description || '当前场景还没有可用描述。';
  const visibleCharacters = stage?.characters || [];
  const hiddenCharacterCount = stage?.hiddenCharacterCount || 0;

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

        <div className="game-character-layer" aria-label="当前场景人物">
          {visibleCharacters.map((character) => (
            <figure
              className={`game-character slot-${character.slot} ${character.isFallbackPortrait ? 'fallback-character' : ''}`}
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
