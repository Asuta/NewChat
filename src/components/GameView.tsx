import { PackageOpen, Send, Square, Trash2, X } from 'lucide-react';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import {
  addInventoryItemReference,
  createInventoryItemReference,
  hasInventoryItemDragType,
  INVENTORY_ITEM_DRAG_MIME_TYPE,
} from '../lib/inventoryItemReferences';
import type {
  ChatMessage,
  Conversation,
  FixedContext,
  InventoryItem,
  InventoryItemReference,
  PlayerInventory,
  PresentationStage,
  StageDialogueEntry,
  WorldActionMenuTarget,
  WorldAction,
  WorldMapState,
  WorldOverview,
} from '../types';
import type { CharacterAttackFeedbackEvent } from './characterAttackFeedback';
import { ChatThread } from './ChatThread';
import { GameStageCanvas } from './GameStageCanvas';
import { buildPortraitStatesByEntity } from './portraitState';

interface GameViewProps {
  standalone?: boolean;
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
  onSend: (content: string, itemReferences: InventoryItemReference[]) => boolean;
  onStop: () => void;
  onEnterScene: (sceneId: string) => void;
  onInventoryOpenChange: (open: boolean) => void;
  onExecuteInventoryAction: (action: WorldAction) => void | Promise<void>;
  onResetSaveData: () => void;
  onCloseEntityActions: () => void;
  onOpenEntityActions: (target: WorldActionMenuTarget) => void;
  onOpenSettings: () => void;
}

interface InventoryItemReferenceRequest {
  requestId: number;
  conversationId: string;
  itemId: string;
}

export function GameView({
  standalone = false,
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
  onResetSaveData,
  onCloseEntityActions,
  onOpenEntityActions,
  onOpenSettings,
}: GameViewProps) {
  const referenceRequestSequence = useRef(0);
  const [itemReferenceRequest, setItemReferenceRequest] = useState<InventoryItemReferenceRequest | null>(null);
  const dialogueEntries = useMemo(
    () => buildStageDialogueEntries(conversation.messages),
    [conversation.messages],
  );
  const portraitStatesByEntity = useMemo(
    () => buildPortraitStatesByEntity(
      conversation.messages,
      world?.time?.currentSceneVisit?.id,
    ),
    [conversation.messages, world?.time?.currentSceneVisit?.id],
  );
  const requestInventoryItemReference = useCallback((item: InventoryItem) => {
    referenceRequestSequence.current += 1;
    setItemReferenceRequest({
      requestId: referenceRequestSequence.current,
      conversationId: conversation.id,
      itemId: item.id,
    });
  }, [conversation.id]);
  const markItemReferenceRequestHandled = useCallback((requestId: number) => {
    setItemReferenceRequest((current) => current?.requestId === requestId ? null : current);
  }, []);

  useEffect(() => {
    setItemReferenceRequest((current) => (
      current?.conversationId === conversation.id ? current : null
    ));
  }, [conversation.id]);

  return (
    <div className={`game-view${standalone ? ' stage-only-game-view' : ''}`}>
      <GameStageCanvas
        stage={stage}
        world={world}
        worldMap={worldMap}
        dialogueKey={conversation.id}
        dialogueEntries={dialogueEntries}
        portraitStatesByEntity={portraitStatesByEntity}
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
            key={conversation.id}
            conversationId={conversation.id}
            isStreaming={isStreaming}
            isDisabled={isInputDisabled}
            inventory={inventory}
            itemReferenceRequest={itemReferenceRequest}
            onSend={onSend}
            onStop={onStop}
            onItemReferenceRequestHandled={markItemReferenceRequestHandled}
          />
        )}
        onEnterScene={onEnterScene}
        onInventoryOpenChange={onInventoryOpenChange}
        onExecuteInventoryAction={onExecuteInventoryAction}
        onReferenceInventoryItem={requestInventoryItemReference}
        onResetSaveData={onResetSaveData}
        onCloseEntityActions={onCloseEntityActions}
        onOpenEntityActions={onOpenEntityActions}
      />

      {standalone ? null : (
        <ChatThread
          conversation={conversation}
          error={error}
          fixedContext={fixedContext}
          onOpenSettings={onOpenSettings}
        />
      )}
    </div>
  );
}

interface GameActionComposerProps {
  conversationId: string;
  isStreaming: boolean;
  isDisabled: boolean;
  inventory: PlayerInventory | null;
  itemReferenceRequest: InventoryItemReferenceRequest | null;
  onSend: (content: string, itemReferences: InventoryItemReference[]) => boolean;
  onStop: () => void;
  onItemReferenceRequestHandled: (requestId: number) => void;
}

function GameActionComposer({
  conversationId,
  isStreaming,
  isDisabled,
  inventory,
  itemReferenceRequest,
  onSend,
  onStop,
  onItemReferenceRequestHandled,
}: GameActionComposerProps) {
  const [value, setValue] = useState('');
  const [itemReferences, setItemReferences] = useState<InventoryItemReference[]>([]);
  const [isItemDragOver, setIsItemDragOver] = useState(false);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [dropNotice, setDropNotice] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragDepthRef = useRef(0);
  const inventoryItemsById = useMemo(
    () => new Map((inventory?.items || []).map((item) => [item.id, item])),
    [inventory],
  );
  const invalidReferences = itemReferences.filter((reference) => !inventoryItemsById.has(reference.itemId));
  const canSend = Boolean(value.trim())
    && invalidReferences.length === 0
    && !isStreaming
    && !isDisabled;

  useEffect(() => {
    const resetDragState = () => {
      dragDepthRef.current = 0;
      setIsItemDragOver(false);
    };
    window.addEventListener('dragend', resetDragState);
    window.addEventListener('drop', resetDragState);
    return () => {
      window.removeEventListener('dragend', resetDragState);
      window.removeEventListener('drop', resetDragState);
    };
  }, []);

  useEffect(() => {
    if (!itemReferenceRequest || itemReferenceRequest.conversationId !== conversationId) return;
    const item = inventoryItemsById.get(itemReferenceRequest.itemId);
    if (item) {
      setItemReferences((current) => addInventoryItemReference(current, item));
      setHighlightedItemId(item.id);
      setDropNotice(null);
      window.requestAnimationFrame(() => textareaRef.current?.focus());
    } else {
      setDropNotice('只能引用当前背包中已经持有的道具');
    }
    onItemReferenceRequestHandled(itemReferenceRequest.requestId);
  }, [
    conversationId,
    inventoryItemsById,
    itemReferenceRequest,
    onItemReferenceRequestHandled,
  ]);

  useEffect(() => {
    if (!highlightedItemId) return;
    const timer = window.setTimeout(() => setHighlightedItemId(null), 650);
    return () => window.clearTimeout(timer);
  }, [highlightedItemId]);

  useEffect(() => {
    if (!dropNotice) return;
    const timer = window.setTimeout(() => setDropNotice(null), 2200);
    return () => window.clearTimeout(timer);
  }, [dropNotice]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const content = value.trim();
    if (!content || invalidReferences.length || isStreaming || isDisabled) return;
    const currentReferences = itemReferences.flatMap((reference) => {
      const item = inventoryItemsById.get(reference.itemId);
      return item ? [createInventoryItemReference(item)] : [];
    });
    if (!onSend(content, currentReferences)) return;
    setValue('');
    setItemReferences([]);
    setDropNotice(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      submit(event);
      return;
    }
    if (event.key === 'Backspace' && !value && itemReferences.length) {
      setItemReferences((current) => current.slice(0, -1));
    }
  }

  function hasInventoryItemDrag(event: ReactDragEvent<HTMLElement>) {
    return hasInventoryItemDragType(event.dataTransfer.types);
  }

  function handleDragEnter(event: ReactDragEvent<HTMLFormElement>) {
    if (isDisabled || isStreaming || !hasInventoryItemDrag(event)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsItemDragOver(true);
  }

  function handleDragOver(event: ReactDragEvent<HTMLFormElement>) {
    if (isDisabled || isStreaming || !hasInventoryItemDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function handleDragLeave(event: ReactDragEvent<HTMLFormElement>) {
    if (!hasInventoryItemDrag(event)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsItemDragOver(false);
  }

  function handleDrop(event: ReactDragEvent<HTMLFormElement>) {
    if (!hasInventoryItemDrag(event)) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsItemDragOver(false);
    if (isDisabled || isStreaming) return;

    const itemId = event.dataTransfer.getData(INVENTORY_ITEM_DRAG_MIME_TYPE).trim();
    const item = inventoryItemsById.get(itemId);
    if (!item) {
      setDropNotice('只能引用当前背包中已经持有的道具');
      return;
    }

    setItemReferences((current) => addInventoryItemReference(current, item));
    setHighlightedItemId(item.id);
    setDropNotice(null);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }

  const referenceStatus = invalidReferences.length
    ? `${invalidReferences.map((reference) => reference.name).join('、')}已不在背包，请先移除`
    : itemReferences.length && !value.trim()
      ? '请描述你想如何使用这些道具'
      : `已引用 ${itemReferences.length} 件道具`;

  return (
    <form
      className={`game-action-composer ${isItemDragOver ? 'is-item-drag-over' : ''}`}
      onSubmit={submit}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <label className="game-action-label" htmlFor="game-action-input">
        你的行动
      </label>
      {itemReferences.length ? (
        <div className="game-action-item-references">
          <div className={`game-action-reference-status ${invalidReferences.length ? 'is-invalid' : ''}`} aria-live="polite">
            <span>{referenceStatus}</span>
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => setItemReferences([])}
            >
              <Trash2 size={12} />
              清空
            </button>
          </div>
          <div className="game-action-reference-list" aria-label="本轮引用的背包道具">
            {itemReferences.map((reference) => {
              const currentItem = inventoryItemsById.get(reference.itemId);
              const isInvalid = !currentItem;
              return (
                <span
                  className={[
                    'game-action-item-reference',
                    `category-${currentItem?.category || reference.category}`,
                    isInvalid ? 'is-invalid' : '',
                    highlightedItemId === reference.itemId ? 'is-highlighted' : '',
                  ].filter(Boolean).join(' ')}
                  key={reference.itemId}
                  title={isInvalid ? `${reference.name}已不在背包` : currentItem?.name}
                >
                  <PackageOpen size={13} />
                  <span>{currentItem?.name || reference.name}</span>
                  {(currentItem?.quantity || reference.quantity) > 1 ? (
                    <small>×{currentItem?.quantity || reference.quantity}</small>
                  ) : null}
                  <button
                    type="button"
                    disabled={isDisabled}
                    aria-label={`移除${currentItem?.name || reference.name}引用`}
                    onClick={() => setItemReferences((current) => (
                      current.filter((candidate) => candidate.itemId !== reference.itemId)
                    ))}
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
      <textarea
        ref={textareaRef}
        id="game-action-input"
        aria-label="输入你的游戏行动"
        placeholder="你想怎么做？例如：询问艾蕾娜关于王冠，或检查黑石棺。"
        rows={2}
        disabled={isDisabled}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {isItemDragOver ? (
        <span className="game-action-drop-overlay" aria-hidden="true">
          <PackageOpen size={20} />
          松开以引用道具
        </span>
      ) : null}
      {dropNotice ? <span className="game-action-drop-notice" role="status">{dropNotice}</span> : null}
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
