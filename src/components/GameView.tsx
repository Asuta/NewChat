import { Send, Square } from 'lucide-react';
import { FormEvent, KeyboardEvent, useMemo, useState } from 'react';
import type {
  ChatMessage,
  Conversation,
  FixedContext,
  InventoryAction,
  PlayerInventory,
  PresentationStage,
  StageDialogueEntry,
  WorldActionMenuTarget,
  WorldMapState,
  WorldOverview,
} from '../types';
import type { CharacterAttackFeedbackEvent } from './characterAttackFeedback';
import { ChatThread } from './ChatThread';
import { GameStageCanvas } from './GameStageCanvas';

interface GameViewProps {
  stage: PresentationStage | null;
  world: WorldOverview | null;
  worldMap: WorldMapState | null;
  actionMenuEntityId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  isWorldMapLoading: boolean;
  isNavigationDisabled: boolean;
  isInputDisabled: boolean;
  inventory: PlayerInventory | null;
  isInventoryOpen: boolean;
  isInventoryLoading: boolean;
  isWorldActionLoading: boolean;
  conversation: Conversation;
  attackFeedback: CharacterAttackFeedbackEvent | null;
  error: string | null;
  fixedContext: FixedContext;
  onSend: (content: string) => void;
  onStop: () => void;
  onEnterScene: (sceneId: string) => void;
  onInventoryOpenChange: (open: boolean) => void;
  onExecuteInventoryAction: (action: InventoryAction) => void | Promise<void>;
  onCloseEntityActions: () => void;
  onOpenEntityActions: (target: WorldActionMenuTarget) => void;
  onOpenSettings: () => void;
}

export function GameView({
  stage,
  world,
  worldMap,
  actionMenuEntityId,
  isLoading,
  isStreaming,
  isWorldMapLoading,
  isNavigationDisabled,
  isInputDisabled,
  inventory,
  isInventoryOpen,
  isInventoryLoading,
  isWorldActionLoading,
  conversation,
  attackFeedback,
  error,
  fixedContext,
  onSend,
  onStop,
  onEnterScene,
  onInventoryOpenChange,
  onExecuteInventoryAction,
  onCloseEntityActions,
  onOpenEntityActions,
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
        attackFeedback={attackFeedback}
        actionMenuEntityId={actionMenuEntityId}
        isLoading={isLoading}
        isWorldMapLoading={isWorldMapLoading}
        isNavigationDisabled={isNavigationDisabled}
        inventory={inventory}
        isInventoryOpen={isInventoryOpen}
        isInventoryLoading={isInventoryLoading}
        isInventoryDisabled={isInputDisabled || isStreaming || isWorldActionLoading}
        actionComposer={(
          <GameActionComposer
            isStreaming={isStreaming}
            isDisabled={isInputDisabled}
            onSend={onSend}
            onStop={onStop}
          />
        )}
        onEnterScene={onEnterScene}
        onInventoryOpenChange={onInventoryOpenChange}
        onExecuteInventoryAction={onExecuteInventoryAction}
        onCloseEntityActions={onCloseEntityActions}
        onOpenEntityActions={onOpenEntityActions}
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

interface GameActionComposerProps {
  isStreaming: boolean;
  isDisabled: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
}

function GameActionComposer({ isStreaming, isDisabled, onSend, onStop }: GameActionComposerProps) {
  const [value, setValue] = useState('');
  const canSend = Boolean(value.trim()) && !isStreaming && !isDisabled;

  function submit(event: FormEvent) {
    event.preventDefault();
    const content = value.trim();
    if (!content || isStreaming || isDisabled) return;
    setValue('');
    onSend(content);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      submit(event);
    }
  }

  return (
    <form className="game-action-composer" onSubmit={submit}>
      <label className="game-action-label" htmlFor="game-action-input">
        你的行动
      </label>
      <textarea
        id="game-action-input"
        aria-label="输入你的游戏行动"
        placeholder="你想怎么做？例如：询问艾蕾娜关于王冠，或检查黑石棺。"
        rows={2}
        disabled={isDisabled}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="game-action-footer">
        <span>Enter 发送 / Shift + Enter 换行</span>
        {isStreaming ? (
          <button className="game-action-submit stop" type="button" onClick={onStop} aria-label="停止生成">
            <Square size={18} />
            <span>停止</span>
          </button>
        ) : (
          <button className="game-action-submit" type="submit" disabled={!canSend} aria-label="发送行动">
            <Send size={18} />
            <span>发送</span>
          </button>
        )}
      </div>
    </form>
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
