import { useMemo } from 'react';
import type {
  ChatMessage,
  Conversation,
  FixedContext,
  PresentationStage,
  StageDialogueEntry,
  WorldMapState,
  WorldOverview,
} from '../types';
import { ChatThread } from './ChatThread';
import { GameStageCanvas } from './GameStageCanvas';

interface GameViewProps {
  stage: PresentationStage | null;
  world: WorldOverview | null;
  worldMap: WorldMapState | null;
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
  isLoading,
  isWorldMapLoading,
  isNavigationDisabled,
  conversation,
  error,
  fixedContext,
  onEnterScene,
  onOpenSettings,
}: GameViewProps) {
  const dialogueEntries = useMemo(
    () => buildStageDialogueEntries(conversation.messages),
    [conversation.messages],
  );

  return (
    <div className="game-view">
      <GameStageCanvas
        stage={stage}
        world={world}
        worldMap={worldMap}
        dialogueKey={conversation.id}
        dialogueEntries={dialogueEntries}
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

function buildStageDialogueEntries(messages: ChatMessage[]): StageDialogueEntry[] {
  const candidates = messages.filter((message) => (
    message.role === 'assistant'
    && (message.kind === undefined || message.kind === 'npc-speech')
    && (message.content.trim() || message.status === 'streaming')
  ));
  const latestRunId = candidates[candidates.length - 1]?.agentRunId;
  const currentRun = latestRunId === undefined
    ? candidates.slice(-1)
    : candidates.filter((message) => message.agentRunId === latestRunId);

  return currentRun.map((message, index) => ({
    id: message.id,
    kind: message.kind === 'npc-speech' ? 'speech' : 'narration',
    ...(message.npcSpeech?.entityId ? { speakerId: message.npcSpeech.entityId } : {}),
    ...(message.npcSpeech?.name ? { speakerName: message.npcSpeech.name } : {}),
    content: message.content,
    status: message.status === 'streaming' && index === currentRun.length - 1 ? 'streaming' : 'complete',
    runId: message.agentRunId,
  }));
}
