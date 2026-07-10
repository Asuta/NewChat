import type {
  Conversation,
  FixedContext,
  PresentationStage,
  StageNarration,
  StageSpeech,
  WorldMapState,
  WorldOverview,
} from '../types';
import { ChatThread } from './ChatThread';
import { GameStageCanvas } from './GameStageCanvas';

interface GameViewProps {
  stage: PresentationStage | null;
  world: WorldOverview | null;
  worldMap: WorldMapState | null;
  activeStageSpeech: StageSpeech | null;
  activeStageNarration: StageNarration | null;
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
  world,
  worldMap,
  activeStageSpeech,
  activeStageNarration,
  isLoading,
  isWorldMapLoading,
  isNavigationDisabled,
  conversation,
  error,
  fixedContext,
  onEnterScene,
  onOpenSettings,
}: GameViewProps) {
  return (
    <div className="game-view">
      <GameStageCanvas
        stage={stage}
        world={world}
        worldMap={worldMap}
        activeStageSpeech={activeStageSpeech}
        activeStageNarration={activeStageNarration}
        isLoading={isLoading}
        isWorldMapLoading={isWorldMapLoading}
        isNavigationDisabled={isNavigationDisabled}
        onEnterScene={onEnterScene}
      />

      <ChatThread
        conversation={conversation}
        error={error}
        fixedContext={fixedContext}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
}
