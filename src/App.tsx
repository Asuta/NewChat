import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatThread } from './components/ChatThread';
import { Composer } from './components/Composer';
import { GameView } from './components/GameView';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { WorldPanel } from './components/WorldPanel';
import {
  buildCompactMessages,
  buildContextEvents,
  createActionResultMessage,
  createConversation,
  createMessage,
  createNpcSpeechMessage,
  createSceneTransitionMessage,
  getCompactableMessages,
  getConversationContextMode,
  getInitialConversations,
  saveConversations,
  stripReasoningFromConversations,
  titleFromMessage,
} from './lib/chat';
import type {
  AgentStep,
  ExecuteWorldActionResponse,
  ChatMessage,
  ContextMode,
  Conversation,
  DisplayMode,
  EntityBundle,
  FixedContext,
  HealthState,
  ModelRequestLog,
  ModelId,
  PresentationStage,
  SaveDataResponse,
  SaveExportMode,
  StageNarration,
  StageSpeech,
  WorldAgentStreamEvent,
  WorldAction,
  WorldEntity,
  WorldMapState,
  WorldOverview,
} from './types';
import type { ThinkingMode } from './types';

const THINKING_MODE_STORAGE_KEY = 'newchat.thinkingMode.v1';
const MODEL_STORAGE_KEY = 'newchat.model.v1';
const AGENT_MAX_STEPS_STORAGE_KEY = 'newchat.agentMaxSteps.v1';
const DEFAULT_AGENT_MAX_STEPS = 30;
const MIN_AGENT_MAX_STEPS = 1;
const MAX_AGENT_MAX_STEPS = 100;
const EMPTY_FIXED_CONTEXT: FixedContext = { content: '', editableContent: '', updatedAt: null, files: [] };
const OPENING_STORY_PROMPT = [
  '新会话刚开始，请由 AI DM 主动给玩家一段故事梗概式开场白。',
  '本轮必须先调用 get_current_scene 读取玩家当前场景数据，再基于当前场景描述、人物、道具、出口和相关设定生成开场。',
  '不要移动场景，不要修改世界状态，不要提及工具名或内部流程。',
  '开场要有氛围感、简洁，并以一个自然的问题或可行动钩子收尾。',
].join('\n');
type PendingSceneTransition = NonNullable<ChatMessage['sceneTransition']>;

interface SendMessageOptions {
  pendingSceneTransition?: PendingSceneTransition;
}

type AgentTaskRole = 'user' | 'system';

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(getInitialConversations);
  const [activeId, setActiveId] = useState(() => conversations[0]?.id || '');
  const [health, setHealth] = useState<HealthState | null>(null);
  const [modelId, setModelId] = useState<ModelId>(getInitialModelId);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('chat');
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>(getInitialThinkingMode);
  const [agentMaxSteps, setAgentMaxSteps] = useState(getInitialAgentMaxSteps);
  const [fixedContext, setFixedContext] = useState<FixedContext>(EMPTY_FIXED_CONTEXT);
  const [lastRequestLog, setLastRequestLog] = useState<ModelRequestLog | null>(null);
  const [world, setWorld] = useState<WorldOverview | null>(null);
  const [worldMap, setWorldMap] = useState<WorldMapState | null>(null);
  const [presentationStage, setPresentationStage] = useState<PresentationStage | null>(null);
  const [stageSpeechByConversation, setStageSpeechByConversation] = useState<Record<string, StageSpeech>>({});
  const [stageNarrationByConversation, setStageNarrationByConversation] = useState<Record<string, StageNarration>>({});
  const [selectedEntity, setSelectedEntity] = useState<EntityBundle | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isWorldLoading, setIsWorldLoading] = useState(false);
  const [isWorldMapLoading, setIsWorldMapLoading] = useState(false);
  const [isPresentationLoading, setIsPresentationLoading] = useState(false);
  const [isFixedContextSaving, setIsFixedContextSaving] = useState(false);
  const [isSaveDataBusy, setIsSaveDataBusy] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const conversationsRef = useRef(conversations);
  const resetDialogRef = useRef<HTMLElement | null>(null);
  const resetCancelButtonRef = useRef<HTMLButtonElement | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) || conversations[0],
    [activeId, conversations],
  );
  const activeStageSpeech = activeConversation ? stageSpeechByConversation[activeConversation.id] || null : null;
  const activeStageNarration = activeConversation ? stageNarrationByConversation[activeConversation.id] || null : null;

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  function setConversationsState(update: Conversation[] | ((current: Conversation[]) => Conversation[])) {
    setConversations((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      conversationsRef.current = next;
      return next;
    });
  }

  useEffect(() => {
    window.localStorage.setItem(THINKING_MODE_STORAGE_KEY, thinkingMode);
  }, [thinkingMode]);

  useEffect(() => {
    window.localStorage.setItem(MODEL_STORAGE_KEY, modelId);
  }, [modelId]);

  useEffect(() => {
    if (!isResetConfirmOpen) return;
    resetCancelButtonRef.current?.focus();
  }, [isResetConfirmOpen]);

  useEffect(() => {
    window.localStorage.setItem(AGENT_MAX_STEPS_STORAGE_KEY, String(agentMaxSteps));
  }, [agentMaxSteps]);

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json())
      .then((state: HealthState) => {
        setHealth(state);
        if (!window.localStorage.getItem(MODEL_STORAGE_KEY) && isModelId(state.model)) {
          setModelId(state.model);
        }
        if (!window.localStorage.getItem(THINKING_MODE_STORAGE_KEY) && isThinkingMode(state.thinking)) {
          setThinkingMode(state.thinking);
        }
      })
      .catch(() => setHealth(null));

    fetch('/api/fixed-context')
      .then((response) => response.json())
      .then((state: FixedContext) => setFixedContext(normalizeFixedContext(state)))
      .catch(() => setFixedContext(EMPTY_FIXED_CONTEXT));

    void refreshWorld();
  }, []);

  useEffect(() => {
    setIsSettingsOpen(false);
  }, [activeId]);

  useEffect(() => {
    if (!world) return;
    void refreshPresentationStage();
    void refreshWorldMap();
  }, [world]);

  function createNewChat() {
    if (isCompressing) return;
    stopStreaming();
    const { conversation, assistantMessage } = createOpeningConversation();
    setConversationsState((current) => [conversation, ...current]);
    setActiveId(conversation.id);
    setError(null);
    void streamAgentResponse({
      conversationId: conversation.id,
      assistantMessageId: assistantMessage.id,
      prompt: OPENING_STORY_PROMPT,
      contextEvents: [],
    });
  }

  function updateConversation(conversationId: string, updater: (conversation: Conversation) => Conversation) {
    setConversationsState((current) =>
      current.map((conversation) => (conversation.id === conversationId ? updater(conversation) : conversation)),
    );
  }

  function updateActiveConversation(updater: (conversation: Conversation) => Conversation) {
    updateConversation(activeConversation.id, updater);
  }

  async function sendMessage(content: string, options: SendMessageOptions = {}) {
    const latestActiveConversation =
      conversationsRef.current.find((conversation) => conversation.id === activeId) || conversationsRef.current[0];
    if (!latestActiveConversation || isStreaming || isCompressing || isFixedContextSaving) return;

    const userMessage = createMessage('user', content);
    const assistantMessage = createMessage('assistant', '', 'streaming');
    const shouldRename = latestActiveConversation.messages.length === 0 && latestActiveConversation.title === '新对话';
    const nextMessages = [...latestActiveConversation.messages, userMessage, assistantMessage];
    const contextEvents = buildContextEvents(latestActiveConversation, [...latestActiveConversation.messages, userMessage]);

    updateConversation(latestActiveConversation.id, (conversation) => ({
      ...conversation,
      title: shouldRename ? titleFromMessage(content) : conversation.title,
      updatedAt: Date.now(),
      messages: nextMessages,
    }));

    await streamAgentResponse({
      conversationId: latestActiveConversation.id,
      assistantMessageId: assistantMessage.id,
      prompt: content,
      contextEvents,
      pendingSceneTransition: options.pendingSceneTransition,
    });
  }

  async function streamAgentResponse({
    conversationId,
    assistantMessageId,
    prompt,
    contextEvents,
    pendingSceneTransition,
    taskRole = 'user',
  }: {
    conversationId: string;
    assistantMessageId: string;
    prompt: string;
    contextEvents: ReturnType<typeof buildContextEvents>;
    pendingSceneTransition?: PendingSceneTransition;
    taskRole?: AgentTaskRole;
  }) {
    setError(null);
    setLastRequestLog(null);
    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    let runId: number | undefined;
    let streamedAnswer = '';
    let streamedSteps: AgentStep[] = [];
    let activeAssistantMessageId = assistantMessageId;
    let activeAssistantContent = '';
    let hasVisibleAssistantContent = false;
    const runAssistantMessageIds = [assistantMessageId];
    let didFinish = false;

    try {
      setAgentSteps([]);
      const response = await fetch('/api/world/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          thinking: thinkingMode,
          prompt,
          taskRole,
          contextEvents,
          maxSteps: agentMaxSteps,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      if (!response.body) {
        throw new Error('世界 Agent 没有返回流式响应。');
      }

      await readWorldAgentStream(response.body, (event) => {
        if (event.type === 'start') {
          runId = event.runId;
          patchAssistantMessage(conversationId, assistantMessageId, (message) => ({
            ...message,
            agentRunId: runId,
          }));
          return;
        }

        if (event.type === 'step') {
          streamedSteps = [...streamedSteps, event.step];
          setAgentSteps(streamedSteps);
          patchAssistantMessage(conversationId, assistantMessageId, (message) => ({
            ...message,
            agentRunId: runId,
            agentSteps: streamedSteps,
          }));
          return;
        }

        if (event.type === 'speech_start') {
          if (hasVisibleAssistantContent || activeAssistantContent) {
            const nextMessage = {
              ...createMessage('assistant', '', 'streaming'),
              agentRunId: runId,
            };
            activeAssistantMessageId = nextMessage.id;
            activeAssistantContent = '';
            runAssistantMessageIds.push(nextMessage.id);
            appendAssistantMessage(conversationId, nextMessage);
          } else {
            activeAssistantMessageId = assistantMessageId;
            activeAssistantContent = '';
          }
          setStageNarrationByConversation((current) => ({
            ...current,
            [conversationId]: {
              content: '',
              createdAt: Date.now(),
              runId,
              messageId: activeAssistantMessageId,
            },
          }));
          return;
        }

        if (event.type === 'answer_delta' || event.type === 'speech_delta') {
          streamedAnswer += event.delta;
          activeAssistantContent += event.delta;
          hasVisibleAssistantContent = true;
          updateAssistantMessage(conversationId, activeAssistantMessageId, activeAssistantContent, 'streaming', {
            agentRunId: runId,
          });
          setStageNarrationByConversation((current) => ({
            ...current,
            [conversationId]: {
              content: activeAssistantContent,
              createdAt: Date.now(),
              runId,
              messageId: activeAssistantMessageId,
            },
          }));
          return;
        }

        if (event.type === 'npc_speech') {
          const npcMessage = createNpcSpeechMessage({
            entityId: event.npcEntityId,
            name: event.npcName,
            content: event.content,
            status: 'streaming',
          });
          setStageSpeechByConversation((current) => ({
            ...current,
            [conversationId]: {
              entityId: event.npcEntityId,
              name: event.npcName,
              content: event.content,
              createdAt: Date.now(),
            },
          }));
          streamedAnswer = streamedAnswer ? `${streamedAnswer}\n\n${event.content}` : event.content;
          hasVisibleAssistantContent = true;

          if (!activeAssistantContent && activeAssistantMessageId === assistantMessageId && runAssistantMessageIds.length === 1) {
            activeAssistantMessageId = assistantMessageId;
            activeAssistantContent = event.content;
            patchAssistantMessage(conversationId, assistantMessageId, (message) => ({
              ...message,
              kind: 'npc-speech',
              content: event.content,
              status: 'streaming',
              agentRunId: runId,
              npcSpeech: {
                entityId: event.npcEntityId,
                name: event.npcName,
              },
            }));
          } else {
            const nextMessage = {
              ...npcMessage,
              agentRunId: runId,
            };
            activeAssistantMessageId = nextMessage.id;
            activeAssistantContent = event.content;
            runAssistantMessageIds.push(nextMessage.id);
            appendAssistantMessage(conversationId, nextMessage);
          }
          return;
        }

        if (event.type === 'done') {
          didFinish = true;
          runId = event.runId;
          streamedAnswer = event.answer || streamedAnswer;
          streamedSteps = event.steps || streamedSteps;
          const modelTranscript = event.modelTranscript || [];
          const completedSceneTransition = getCompletedSceneTransition(streamedSteps, pendingSceneTransition);
          setLastRequestLog(event.requestLog || { entries: [] });
          setAgentSteps(streamedSteps);
          setWorld(event.world);
          if (!hasVisibleAssistantContent) {
            updateAssistantMessage(conversationId, assistantMessageId, streamedAnswer || '世界 Agent 没有返回内容。', 'done', {
              agentRunId: runId,
              agentSteps: streamedSteps,
              modelTranscript,
            });
          } else {
            markAssistantMessagesDone(conversationId, runAssistantMessageIds, {
              agentRunId: runId,
              agentSteps: streamedSteps,
              modelTranscript,
              primaryMessageId: assistantMessageId,
            });
          }
          if (completedSceneTransition) {
            appendSceneTransitionMessage(conversationId, completedSceneTransition);
          }
          return;
        }

        if (event.type === 'error') {
          throw new Error(event.error || '世界 Agent 执行失败。');
        }
      });

      if (!didFinish) {
        throw new Error('世界 Agent 流式响应提前结束。');
      }
    } catch (caught) {
      if (controller.signal.aborted) {
        markAssistantMessagesInterrupted(conversationId, runAssistantMessageIds, {
          activeMessageId: activeAssistantMessageId,
          fallbackContent: '已停止生成。',
          agentRunId: runId,
          agentSteps: streamedSteps,
          primaryMessageId: assistantMessageId,
        });
      } else {
        const message = caught instanceof Error ? caught.message : '未知错误';
        setError(message);
        markAssistantMessagesInterrupted(conversationId, runAssistantMessageIds, {
          activeMessageId: activeAssistantMessageId,
          fallbackContent: message,
          agentRunId: runId,
          agentSteps: streamedSteps,
          primaryMessageId: assistantMessageId,
        });
      }
    } finally {
      if (abortRef.current === controller) {
        setIsStreaming(false);
        abortRef.current = null;
      }
    }
  }

  function appendAssistantMessage(conversationId: string, message: ChatMessage) {
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
      messages: [...conversation.messages, message],
    }));
  }

  function updateAssistantMessage(
    conversationId: string,
    messageId: string,
    content: string,
    status: ChatMessage['status'],
    metadata: Pick<ChatMessage, 'agentRunId' | 'agentSteps' | 'modelTranscript'> = {},
  ) {
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
      messages: conversation.messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              content,
              status,
              ...metadata,
            }
          : message,
      ),
    }));
  }

  function markAssistantMessagesDone(
    conversationId: string,
    messageIds: string[],
    metadata: Pick<ChatMessage, 'agentRunId' | 'agentSteps' | 'modelTranscript'> & { primaryMessageId: string },
  ) {
    const ids = new Set(messageIds);
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
      messages: conversation.messages.map((message) => {
        if (!ids.has(message.id)) return message;
        return {
          ...message,
          status: 'done',
          agentRunId: metadata.agentRunId,
          ...(message.id === metadata.primaryMessageId
            ? { agentSteps: metadata.agentSteps, modelTranscript: metadata.modelTranscript }
            : {}),
        };
      }),
    }));
  }

  function markAssistantMessagesInterrupted(
    conversationId: string,
    messageIds: string[],
    metadata: Pick<ChatMessage, 'agentRunId' | 'agentSteps'> & {
      activeMessageId: string;
      fallbackContent: string;
      primaryMessageId: string;
    },
  ) {
    const ids = new Set(messageIds);
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
      messages: conversation.messages.map((message) => {
        if (!ids.has(message.id)) return message;
        const isActive = message.id === metadata.activeMessageId;
        const isPrimary = message.id === metadata.primaryMessageId;
        return {
          ...message,
          content: isActive && !message.content.trim() ? metadata.fallbackContent : message.content,
          status: isActive ? 'error' : 'done',
          agentRunId: metadata.agentRunId,
          ...(isPrimary ? { agentSteps: metadata.agentSteps } : {}),
        };
      }),
    }));
  }

  function patchAssistantMessage(conversationId: string, messageId: string, updater: (message: ChatMessage) => ChatMessage) {
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
      messages: conversation.messages.map((message) => (message.id === messageId ? updater(message) : message)),
    }));
  }

  function appendSceneTransitionMessage(conversationId: string, transition: PendingSceneTransition) {
    const transitionMessage = createSceneTransitionMessage(transition);
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
      messages: [...conversation.messages, transitionMessage],
    }));
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  async function compactConversation() {
    if (!activeConversation || isStreaming || isCompressing) return;

    const compactableMessages = getCompactableMessages(activeConversation);
    if (!compactableMessages.length) return;

    setError(null);
    setIsCompressing(true);
    const conversationId = activeConversation.id;
    const lastMessageId = compactableMessages[compactableMessages.length - 1]?.id || null;

    try {
      const response = await fetch('/api/chat/compact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          thinking: thinkingMode,
          messages: buildCompactMessages(activeConversation),
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as { summary?: string };
      const summary = data.summary?.trim();
      if (!summary) {
        throw new Error('模型没有返回可用摘要。');
      }

      setConversationsState((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                updatedAt: Date.now(),
                contextSummary: {
                  content: summary,
                  compressedAt: Date.now(),
                  messageCount: compactableMessages.length,
                  lastMessageId,
                },
              }
            : conversation,
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '上下文压缩失败。');
    } finally {
      setIsCompressing(false);
    }
  }

  function updateContextMode(mode: ContextMode) {
    if (!activeConversation || isStreaming || isCompressing) return;
    updateActiveConversation((conversation) => ({
      ...conversation,
      contextMode: mode,
      updatedAt: Date.now(),
    }));
  }

  function updateAgentMaxSteps(value: number) {
    setAgentMaxSteps(normalizeAgentMaxSteps(value));
  }

  async function saveFixedContext(content: string) {
    if (isStreaming || isCompressing || isFixedContextSaving) return;
    setIsFixedContextSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/fixed-context', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const state = (await response.json()) as FixedContext;
      setFixedContext(normalizeFixedContext(state));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '固定上下文保存失败。');
    } finally {
      setIsFixedContextSaving(false);
    }
  }

  function clearFixedContext() {
    void saveFixedContext('');
  }

  function clearCurrentChat() {
    if (!activeConversation || isStreaming || isCompressing) return;
    const conversationId = activeConversation.id;
    updateActiveConversation((conversation) => ({
      ...conversation,
      title: '新对话',
      updatedAt: Date.now(),
      messages: [],
      contextSummary: undefined,
    }));
    setStageSpeechByConversation((current) => {
      const next = { ...current };
      delete next[conversationId];
      return next;
    });
    setStageNarrationByConversation((current) => {
      const next = { ...current };
      delete next[conversationId];
      return next;
    });
    setError(null);
  }

  function requestResetSaveData() {
    if (isStreaming || isCompressing || isSaveDataBusy) return;
    setIsSettingsOpen(false);
    setIsResetConfirmOpen(true);
  }

  async function resetSaveData() {
    if (isStreaming || isCompressing || isSaveDataBusy) return;

    setIsResetConfirmOpen(false);
    setIsSaveDataBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/save/reset', { method: 'POST' });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const state = (await response.json()) as SaveDataResponse;
      const { conversation, assistantMessage } = createOpeningConversation();
      applySaveDataResponse(state, { resetConversations: true, openingConversation: conversation });
      void streamAgentResponse({
        conversationId: conversation.id,
        assistantMessageId: assistantMessage.id,
        prompt: OPENING_STORY_PROMPT,
        contextEvents: [],
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '重置存档失败。');
    } finally {
      setIsSaveDataBusy(false);
    }
  }

  function handleResetConfirmKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!isSaveDataBusy) setIsResetConfirmOpen(false);
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = resetDialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;

    const focusableElements = Array.from(focusable);
    event.preventDefault();
    const currentIndex = focusableElements.findIndex((element) => element === document.activeElement);
    const fallbackIndex = event.shiftKey ? focusableElements.length : -1;
    const nextIndex = event.shiftKey
      ? (currentIndex >= 0 ? currentIndex : fallbackIndex) - 1
      : (currentIndex >= 0 ? currentIndex : fallbackIndex) + 1;
    focusableElements[(nextIndex + focusableElements.length) % focusableElements.length].focus();
  }

  async function exportSaveData(mode: SaveExportMode) {
    if (isSaveDataBusy) return;

    setIsSaveDataBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/save/export?mode=${mode}`);
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const bundle = (await response.json()) as Record<string, unknown> & {
        save?: Record<string, unknown>;
      };

      if (mode === 'full') {
        bundle.save = {
          ...(bundle.save || {}),
          conversations: stripReasoningFromConversations(conversations),
        };
      }

      downloadJsonBundle(bundle, mode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '导出世界包失败。');
    } finally {
      setIsSaveDataBusy(false);
    }
  }

  async function importSaveData(file: File) {
    if (isStreaming || isCompressing || isSaveDataBusy) return;
    if (!window.confirm('导入世界包会覆盖当前模板、当前存档、固定上下文和可恢复的聊天记录。确定继续吗？')) return;

    setIsSaveDataBusy(true);
    setError(null);
    try {
      const bundle = JSON.parse(await file.text()) as unknown;
      const response = await fetch('/api/save/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bundle),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const state = (await response.json()) as SaveDataResponse;
      applySaveDataResponse(state, { resetConversations: !state.conversations?.length });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '导入世界包失败。');
    } finally {
      setIsSaveDataBusy(false);
    }
  }

  function applySaveDataResponse(
    state: SaveDataResponse,
    options: { resetConversations: boolean; openingConversation?: Conversation },
  ) {
    setWorld(state.world);
    setFixedContext(normalizeFixedContext(state.fixedContext));
    setSelectedEntity(null);
    setAgentSteps([]);
    setLastRequestLog(null);
    setStageSpeechByConversation({});
    setStageNarrationByConversation({});

    if (options.resetConversations) {
      const next = options.openingConversation || createConversation();
      setConversationsState([next]);
      setActiveId(next.id);
      return;
    }

    const nextConversations = normalizeImportedConversations(state.conversations);
    setConversationsState(nextConversations);
    setActiveId(nextConversations[0]?.id || '');
  }

  async function refreshWorld() {
    setIsWorldLoading(true);
    try {
      const response = await fetch('/api/world');
      if (!response.ok) throw new Error(await readErrorMessage(response));
      setWorld((await response.json()) as WorldOverview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '世界数据库读取失败。');
    } finally {
      setIsWorldLoading(false);
    }
  }

  async function refreshPresentationStage() {
    setIsPresentationLoading(true);
    try {
      const response = await fetch('/api/presentation/current-stage');
      if (!response.ok) throw new Error(await readErrorMessage(response));
      setPresentationStage((await response.json()) as PresentationStage);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '表现层读取失败。');
    } finally {
      setIsPresentationLoading(false);
    }
  }

  async function refreshWorldMap() {
    setIsWorldMapLoading(true);
    try {
      const response = await fetch('/api/world/map');
      if (!response.ok) throw new Error(await readErrorMessage(response));
      setWorldMap((await response.json()) as WorldMapState);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '世界地图读取失败。');
    } finally {
      setIsWorldMapLoading(false);
    }
  }

  async function selectWorldEntity(entityId: string) {
    setIsWorldLoading(true);
    try {
      const response = await fetch(`/api/world/entities/${encodeURIComponent(entityId)}`);
      if (!response.ok) throw new Error(await readErrorMessage(response));
      setSelectedEntity((await response.json()) as EntityBundle);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '实体详情读取失败。');
    } finally {
      setIsWorldLoading(false);
    }
  }

  async function searchWorld(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      await refreshWorld();
      return;
    }

    setIsWorldLoading(true);
    try {
      const response = await fetch(`/api/world/entities?query=${encodeURIComponent(trimmed)}&limit=1`);
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const data = (await response.json()) as { entities?: WorldEntity[] };
      const first = data.entities?.[0];
      if (!first) {
        setError(`没有找到“${trimmed}”。`);
        return;
      }
      await selectWorldEntity(first.id);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '世界搜索失败。');
    } finally {
      setIsWorldLoading(false);
    }
  }

  async function enterWorldScene(sceneId: string) {
    if (isStreaming || isCompressing || isFixedContextSaving) return;
    const previousScene = world?.currentScene.scene;
    const targetScene = world?.currentScene.exits.find((exit) => exit.scene.id === sceneId)?.scene;
    const fromSceneName = previousScene?.name || '未知场景';
    const toSceneName = targetScene?.name || sceneId;
    const prompt = [
      `我想从「${fromSceneName}」前往「${toSceneName}」。`,
      `请作为 AI DM 判定这次场景移动是否能够成功。`,
      `如果成功，请调用 enter_scene 工具应用场景移动到目标场景（sceneId: ${sceneId}）；如果失败，请保持当前位置并说明原因。`,
    ].join('');

    await sendMessage(prompt, {
      pendingSceneTransition: {
        fromSceneId: previousScene?.id || null,
        fromSceneName,
        toSceneId: targetScene?.id || sceneId,
        toSceneName,
      },
    });
  }

  async function requestWorldActions(targetId: string): Promise<WorldAction[]> {
    if (isStreaming) throw new Error('DM 正在叙事，动作暂不可用。');
    if (isCompressing || isFixedContextSaving || isSaveDataBusy) throw new Error('系统正在处理数据，动作暂不可用。');
    const response = await fetch(`/api/world/actions?actorId=player&targetId=${encodeURIComponent(targetId)}`);
    if (!response.ok) throw new Error(await readErrorMessage(response));
    const data = (await response.json()) as { actions?: WorldAction[] };
    return Array.isArray(data.actions) ? data.actions : [];
  }

  async function executeWorldAction(action: WorldAction) {
    if (!activeConversation || isStreaming || isCompressing || isFixedContextSaving || isSaveDataBusy) return;
    setError(null);
    setIsWorldLoading(true);
    try {
      const response = await fetch('/api/world/actions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const data = (await response.json()) as ExecuteWorldActionResponse;
      const actionMessage = createActionResultMessage(data.result);
      const assistantMessage = createMessage('assistant', '', 'streaming');
      const nextMessages = [...activeConversation.messages, actionMessage, assistantMessage];
      const contextEvents = buildContextEvents(activeConversation, [...activeConversation.messages, actionMessage]);
      setWorld(data.world);
      updateActiveConversation((conversation) => ({
        ...conversation,
        updatedAt: Date.now(),
        messages: nextMessages,
      }));
      if (selectedEntity?.entity.id === action.targetId) {
        void selectWorldEntity(action.targetId);
      }
      await streamAgentResponse({
        conversationId: activeConversation.id,
        assistantMessageId: assistantMessage.id,
        prompt: [
          '请根据刚刚的本地硬逻辑动作结果进行 AI DM 叙事。',
          'action_result 中的 facts 和 stateChanges 已经发生并写入世界数据，禁止重掷、重算、反转命中、伤害或 HP。',
          '请叙事化这个结果，然后判断受影响 NPC 或周围环境是否应立即反应；如需要规则裁定或世界状态变化，请继续调用合适工具。',
        ].join('\n'),
        contextEvents,
        taskRole: 'system',
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '动作执行失败。');
    } finally {
      setIsWorldLoading(false);
    }
  }

  if (!activeConversation) {
    return null;
  }

  return (
    <main className="app-shell">
      <Sidebar
        conversations={conversations}
        activeId={activeConversation.id}
        onNewChat={createNewChat}
        onSelect={(id) => {
          if (!isStreaming && !isCompressing) setActiveId(id);
        }}
      />
      <section className="chat-pane" aria-label="聊天">
        <TopBar
          conversation={activeConversation}
          health={health}
          isStreaming={isStreaming}
          isCompressing={isCompressing}
          isFixedContextSaving={isFixedContextSaving}
          canCompress={getCompactableMessages(activeConversation).length > 0}
          isSettingsOpen={isSettingsOpen}
          fixedContext={fixedContext}
          requestLog={lastRequestLog}
          modelId={modelId}
          displayMode={displayMode}
          onModelChange={setModelId}
          onDisplayModeChange={setDisplayMode}
          thinkingMode={thinkingMode}
          onThinkingModeChange={setThinkingMode}
          agentMaxSteps={agentMaxSteps}
          onAgentMaxStepsChange={updateAgentMaxSteps}
          contextMode={getConversationContextMode(activeConversation)}
          onContextModeChange={updateContextMode}
          onCompress={compactConversation}
          onSettingsOpenChange={setIsSettingsOpen}
          onSaveFixedContext={saveFixedContext}
          onClearFixedContext={clearFixedContext}
          onClearChat={clearCurrentChat}
          onResetSaveData={requestResetSaveData}
          onExportSaveData={exportSaveData}
          onImportSaveData={importSaveData}
          isSaveDataBusy={isSaveDataBusy}
        />
        {displayMode === 'game' ? (
          <GameView
            stage={presentationStage}
            worldMap={worldMap}
            activeStageSpeech={activeStageSpeech}
            activeStageNarration={activeStageNarration}
            isLoading={isPresentationLoading}
            isWorldMapLoading={isWorldMapLoading}
            isNavigationDisabled={isStreaming || isCompressing || isFixedContextSaving || isSaveDataBusy}
            conversation={activeConversation}
            error={error}
            fixedContext={fixedContext}
            onEnterScene={enterWorldScene}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        ) : (
          <ChatThread
            conversation={activeConversation}
            error={error}
            fixedContext={fixedContext}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}
        <Composer
          isStreaming={isStreaming}
          isDisabled={isCompressing || isFixedContextSaving || isSaveDataBusy}
          onSend={sendMessage}
          onStop={stopStreaming}
        />
      </section>
      <WorldPanel
        world={world}
        selectedEntity={selectedEntity}
        agentSteps={agentSteps}
        isLoading={isWorldLoading}
        onRefresh={refreshWorld}
        onEnterScene={enterWorldScene}
        onSearch={searchWorld}
        onSelectEntity={selectWorldEntity}
        onRequestEntityActions={requestWorldActions}
        onExecuteWorldAction={executeWorldAction}
      />
      {isResetConfirmOpen ? (
        <div className="confirmation-backdrop" role="presentation">
          <section
            ref={resetDialogRef}
            className="confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-save-title"
            onKeyDown={handleResetConfirmKeyDown}
          >
            <div className="confirmation-copy">
              <strong id="reset-save-title">重新开始？</strong>
              <p>这会用当前世界模板覆盖玩家存档，并清空当前聊天记录。这个操作无法撤销。</p>
            </div>
            <div className="confirmation-actions">
              <button
                ref={resetCancelButtonRef}
                className="settings-secondary"
                type="button"
                disabled={isSaveDataBusy}
                onClick={() => setIsResetConfirmOpen(false)}
              >
                取消
              </button>
              <button className="settings-danger" type="button" disabled={isSaveDataBusy} onClick={() => void resetSaveData()}>
                重新开始
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function normalizeFixedContext(state: Partial<FixedContext> | null | undefined): FixedContext {
  return {
    content: typeof state?.content === 'string' ? state.content : '',
    editableContent: typeof state?.editableContent === 'string' ? state.editableContent : typeof state?.content === 'string' ? state.content : '',
    updatedAt: typeof state?.updatedAt === 'number' ? state.updatedAt : null,
    files: Array.isArray(state?.files)
      ? state.files.map((file) => ({
          name: typeof file?.name === 'string' ? file.name : '',
          order: typeof file?.order === 'number' ? file.order : 0,
          content: typeof file?.content === 'string' ? file.content : '',
          updatedAt: typeof file?.updatedAt === 'number' ? file.updatedAt : null,
        }))
      : [],
  };
}

function createOpeningConversation() {
  const assistantMessage = createMessage('assistant', '', 'streaming');
  return {
    conversation: {
      ...createConversation('故事开场'),
      messages: [assistantMessage],
    },
    assistantMessage,
  };
}

function normalizeImportedConversations(value: unknown): Conversation[] {
  if (!Array.isArray(value)) {
    return [createConversation()];
  }

  const conversations = value.filter((conversation): conversation is Conversation => {
    const candidate = conversation as Partial<Conversation>;
    return (
      Boolean(conversation) &&
      typeof conversation === 'object' &&
      typeof candidate.id === 'string' &&
      typeof candidate.title === 'string' &&
      Array.isArray(candidate.messages)
    );
  });

  return conversations.length > 0 ? conversations : [createConversation()];
}

function downloadJsonBundle(bundle: unknown, mode: SaveExportMode) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  anchor.href = url;
  anchor.download = `newchat-${mode}-${timestamp}.newchat-save.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function readErrorMessage(response: Response) {
  const text = await response.text();
  if (!text) return `请求失败：${response.status}`;
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error || text;
  } catch {
    return text;
  }
}

async function readWorldAgentStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: WorldAgentStreamEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\n\n/);
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      const event = parseWorldAgentStreamEvent(block);
      if (event) onEvent(event);
    }
  }

  const finalBlock = buffer.trim();
  if (finalBlock) {
    const event = parseWorldAgentStreamEvent(finalBlock);
    if (event) onEvent(event);
  }
}

function parseWorldAgentStreamEvent(block: string): WorldAgentStreamEvent | null {
  const lines = block.split(/\r?\n/);
  const eventType = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n');

  if (!eventType || !data) return null;
  const payload = JSON.parse(data) as Record<string, unknown>;

  if (eventType === 'start') {
    return { type: 'start', runId: Number(payload.runId) };
  }
  if (eventType === 'step') {
    return { type: 'step', step: payload.step as AgentStep };
  }
  if (eventType === 'speech_start') {
    return {
      type: 'speech_start',
      runId: typeof payload.runId === 'number' ? payload.runId : undefined,
      stepIndex: typeof payload.stepIndex === 'number' ? payload.stepIndex : undefined,
    };
  }
  if (eventType === 'answer_delta') {
    return { type: 'answer_delta', delta: String(payload.delta || '') };
  }
  if (eventType === 'speech_delta') {
    return { type: 'speech_delta', delta: String(payload.delta || '') };
  }
  if (eventType === 'npc_speech') {
    return {
      type: 'npc_speech',
      npcEntityId: String(payload.npcEntityId || ''),
      npcName: String(payload.npcName || ''),
      content: String(payload.content || ''),
      runId: typeof payload.runId === 'number' ? payload.runId : undefined,
      stepIndex: typeof payload.stepIndex === 'number' ? payload.stepIndex : undefined,
    };
  }
  if (eventType === 'done') {
    return {
      type: 'done',
      answer: String(payload.answer || ''),
      runId: Number(payload.runId),
      steps: Array.isArray(payload.steps) ? (payload.steps as AgentStep[]) : [],
      modelTranscript: Array.isArray(payload.modelTranscript) ? payload.modelTranscript : [],
      world: payload.world as WorldOverview,
      requestLog: payload.requestLog as ModelRequestLog | undefined,
    };
  }
  if (eventType === 'error') {
    return { type: 'error', error: String(payload.error || '世界 Agent 执行失败。') };
  }

  return null;
}

function getCompletedSceneTransition(
  steps: AgentStep[],
  pendingTransition?: PendingSceneTransition,
): PendingSceneTransition | null {
  if (!pendingTransition) return null;

  const completedStep = steps.find((step) => {
    if (step.tool !== 'enter_scene' || step.result?.ok !== true) return false;
    const argsSceneId = typeof step.args?.sceneId === 'string' ? step.args.sceneId : '';
    const resultScene = getStepResultScene(step);
    return argsSceneId === pendingTransition.toSceneId || resultScene?.id === pendingTransition.toSceneId;
  });
  if (!completedStep) return null;

  const resultScene = getStepResultScene(completedStep);
  return {
    ...pendingTransition,
    toSceneId: resultScene?.id || pendingTransition.toSceneId,
    toSceneName: resultScene?.name || pendingTransition.toSceneName,
  };
}

function getStepResultScene(step: AgentStep): { id?: string; name?: string } | null {
  const sceneState = step.result?.scene;
  if (!sceneState || typeof sceneState !== 'object') return null;

  const scene = 'id' in sceneState || 'name' in sceneState ? sceneState : (sceneState as { scene?: unknown }).scene;
  if (!scene || typeof scene !== 'object') return null;

  return scene as { id?: string; name?: string };
}

function getInitialThinkingMode(): ThinkingMode {
  const stored = window.localStorage.getItem(THINKING_MODE_STORAGE_KEY);
  return isThinkingMode(stored) ? stored : 'enabled';
}

function getInitialModelId(): ModelId {
  const stored = window.localStorage.getItem(MODEL_STORAGE_KEY);
  return isModelId(stored) ? stored : 'deepseek-v4-flash';
}

function getInitialAgentMaxSteps() {
  const stored = window.localStorage.getItem(AGENT_MAX_STEPS_STORAGE_KEY);
  return stored == null || stored === '' ? DEFAULT_AGENT_MAX_STEPS : normalizeAgentMaxSteps(stored);
}

function normalizeAgentMaxSteps(value: unknown) {
  if (value == null || value === '') return DEFAULT_AGENT_MAX_STEPS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_AGENT_MAX_STEPS;
  return Math.min(MAX_AGENT_MAX_STEPS, Math.max(MIN_AGENT_MAX_STEPS, Math.floor(parsed)));
}

function isThinkingMode(value: unknown): value is ThinkingMode {
  return value === 'enabled' || value === 'disabled';
}

function isModelId(value: unknown): value is ModelId {
  return value === 'deepseek-v4-flash' || value === 'deepseek-v4-pro';
}
