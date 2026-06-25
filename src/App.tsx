import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatThread } from './components/ChatThread';
import { Composer } from './components/Composer';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { WorldPanel } from './components/WorldPanel';
import {
  buildModelMessages,
  buildCompactMessages,
  createConversation,
  createMessage,
  createSceneTransitionMessage,
  getCompactableMessages,
  getConversationContextMode,
  getInitialConversations,
  saveConversations,
  titleFromMessage,
} from './lib/chat';
import type {
  AgentStep,
  ChatMessage,
  ContextMode,
  Conversation,
  EntityBundle,
  FixedContext,
  HealthState,
  ModelRequestLog,
  ModelId,
  SaveDataResponse,
  SaveExportMode,
  WorldAgentStreamEvent,
  WorldEntity,
  WorldOverview,
} from './types';
import type { ThinkingMode } from './types';

const THINKING_MODE_STORAGE_KEY = 'newchat.thinkingMode.v1';
const MODEL_STORAGE_KEY = 'newchat.model.v1';
const EMPTY_FIXED_CONTEXT: FixedContext = { content: '', editableContent: '', updatedAt: null, files: [] };

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(getInitialConversations);
  const [activeId, setActiveId] = useState(() => conversations[0]?.id || '');
  const [health, setHealth] = useState<HealthState | null>(null);
  const [modelId, setModelId] = useState<ModelId>(getInitialModelId);
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>(getInitialThinkingMode);
  const [fixedContext, setFixedContext] = useState<FixedContext>(EMPTY_FIXED_CONTEXT);
  const [lastRequestLog, setLastRequestLog] = useState<ModelRequestLog | null>(null);
  const [world, setWorld] = useState<WorldOverview | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<EntityBundle | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isWorldLoading, setIsWorldLoading] = useState(false);
  const [isFixedContextSaving, setIsFixedContextSaving] = useState(false);
  const [isSaveDataBusy, setIsSaveDataBusy] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) || conversations[0],
    [activeId, conversations],
  );

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    window.localStorage.setItem(THINKING_MODE_STORAGE_KEY, thinkingMode);
  }, [thinkingMode]);

  useEffect(() => {
    window.localStorage.setItem(MODEL_STORAGE_KEY, modelId);
  }, [modelId]);

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

  function createNewChat() {
    if (isCompressing) return;
    stopStreaming();
    const next = createConversation();
    setConversations((current) => [next, ...current]);
    setActiveId(next.id);
    setError(null);
  }

  function updateActiveConversation(updater: (conversation: Conversation) => Conversation) {
    setConversations((current) =>
      current.map((conversation) => (conversation.id === activeConversation.id ? updater(conversation) : conversation)),
    );
  }

  async function sendMessage(content: string) {
    if (!activeConversation || isStreaming || isCompressing || isFixedContextSaving) return;

    const userMessage = createMessage('user', content);
    const assistantMessage = createMessage('assistant', '', 'streaming');
    const shouldRename = activeConversation.messages.length === 0 && activeConversation.title === '新对话';
    const nextMessages = [...activeConversation.messages, userMessage, assistantMessage];
    const requestMessages = buildModelMessages(activeConversation, nextMessages, EMPTY_FIXED_CONTEXT, assistantMessage.id);

    updateActiveConversation((conversation) => ({
      ...conversation,
      title: shouldRename ? titleFromMessage(content) : conversation.title,
      updatedAt: Date.now(),
      messages: nextMessages,
    }));

    setError(null);
    setLastRequestLog(null);
    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setAgentSteps([]);
      const response = await fetch('/api/world/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          thinking: thinkingMode,
          prompt: content,
          messages: requestMessages,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      if (!response.body) {
        throw new Error('世界 Agent 没有返回流式响应。');
      }

      let runId: number | undefined;
      let streamedAnswer = '';
      let streamedSteps: AgentStep[] = [];
      let didFinish = false;

      await readWorldAgentStream(response.body, (event) => {
        if (event.type === 'start') {
          runId = event.runId;
          patchAssistantMessage(assistantMessage.id, (message) => ({
            ...message,
            agentRunId: runId,
          }));
          return;
        }

        if (event.type === 'step') {
          streamedSteps = [...streamedSteps, event.step];
          setAgentSteps(streamedSteps);
          patchAssistantMessage(assistantMessage.id, (message) => ({
            ...message,
            agentRunId: runId,
            agentSteps: streamedSteps,
          }));
          return;
        }

        if (event.type === 'answer_delta') {
          streamedAnswer += event.delta;
          updateAssistantMessage(assistantMessage.id, streamedAnswer, 'streaming', {
            agentRunId: runId,
            agentSteps: streamedSteps,
          });
          return;
        }

        if (event.type === 'done') {
          didFinish = true;
          runId = event.runId;
          streamedAnswer = event.answer || streamedAnswer;
          streamedSteps = event.steps || streamedSteps;
          setLastRequestLog(event.requestLog || { entries: [] });
          setAgentSteps(streamedSteps);
          setWorld(event.world);
          updateAssistantMessage(assistantMessage.id, streamedAnswer || '世界 Agent 没有返回内容。', 'done', {
            agentRunId: runId,
            agentSteps: streamedSteps,
          });
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
        updateAssistantMessage(assistantMessage.id, '已停止生成。', 'error');
      } else {
        const message = caught instanceof Error ? caught.message : '未知错误';
        setError(message);
        updateAssistantMessage(assistantMessage.id, message, 'error');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function updateAssistantMessage(
    messageId: string,
    content: string,
    status: ChatMessage['status'],
    metadata: Pick<ChatMessage, 'agentRunId' | 'agentSteps'> = {},
  ) {
    updateActiveConversation((conversation) => ({
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

  function patchAssistantMessage(messageId: string, updater: (message: ChatMessage) => ChatMessage) {
    updateActiveConversation((conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
      messages: conversation.messages.map((message) => (message.id === messageId ? updater(message) : message)),
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

      setConversations((current) =>
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
    updateActiveConversation((conversation) => ({
      ...conversation,
      title: '新对话',
      updatedAt: Date.now(),
      messages: [],
      contextSummary: undefined,
    }));
    setError(null);
  }

  async function resetSaveData() {
    if (isStreaming || isCompressing || isSaveDataBusy) return;
    if (!window.confirm('重置会用当前世界模板覆盖玩家存档，并清空当前聊天记录。确定继续吗？')) return;

    setIsSaveDataBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/save/reset', { method: 'POST' });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const state = (await response.json()) as SaveDataResponse;
      applySaveDataResponse(state, { resetConversations: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '重置存档失败。');
    } finally {
      setIsSaveDataBusy(false);
    }
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
          conversations,
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

  function applySaveDataResponse(state: SaveDataResponse, options: { resetConversations: boolean }) {
    setWorld(state.world);
    setFixedContext(normalizeFixedContext(state.fixedContext));
    setSelectedEntity(null);
    setAgentSteps([]);
    setLastRequestLog(null);

    if (options.resetConversations) {
      const next = createConversation();
      setConversations([next]);
      setActiveId(next.id);
      return;
    }

    const nextConversations = normalizeImportedConversations(state.conversations);
    setConversations(nextConversations);
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
    if (isStreaming || isCompressing) return;
    const previousScene = world?.currentScene.scene;
    setIsWorldLoading(true);
    try {
      const response = await fetch('/api/world/scene/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const currentScene = await response.json();
      await refreshWorld();
      const fromSceneName = previousScene?.name || '未知场景';
      const toSceneName = currentScene.scene?.name || sceneId;
      const transitionMessage = createSceneTransitionMessage({
        fromSceneId: previousScene?.id || null,
        fromSceneName,
        toSceneId: currentScene.scene?.id || sceneId,
        toSceneName,
      });
      updateActiveConversation((conversation) => ({
        ...conversation,
        updatedAt: Date.now(),
        messages: [...conversation.messages, transitionMessage],
      }));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '场景切换失败。');
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
          onModelChange={setModelId}
          thinkingMode={thinkingMode}
          onThinkingModeChange={setThinkingMode}
          contextMode={getConversationContextMode(activeConversation)}
          onContextModeChange={updateContextMode}
          onCompress={compactConversation}
          onSettingsOpenChange={setIsSettingsOpen}
          onSaveFixedContext={saveFixedContext}
          onClearFixedContext={clearFixedContext}
          onClearChat={clearCurrentChat}
          onResetSaveData={resetSaveData}
          onExportSaveData={exportSaveData}
          onImportSaveData={importSaveData}
          isSaveDataBusy={isSaveDataBusy}
        />
        <ChatThread
          conversation={activeConversation}
          error={error}
          fixedContext={fixedContext}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
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
      />
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
  if (eventType === 'answer_delta') {
    return { type: 'answer_delta', delta: String(payload.delta || '') };
  }
  if (eventType === 'done') {
    return {
      type: 'done',
      answer: String(payload.answer || ''),
      runId: Number(payload.runId),
      steps: Array.isArray(payload.steps) ? (payload.steps as AgentStep[]) : [],
      world: payload.world as WorldOverview,
      requestLog: payload.requestLog as ModelRequestLog | undefined,
    };
  }
  if (eventType === 'error') {
    return { type: 'error', error: String(payload.error || '世界 Agent 执行失败。') };
  }

  return null;
}

function getInitialThinkingMode(): ThinkingMode {
  const stored = window.localStorage.getItem(THINKING_MODE_STORAGE_KEY);
  return isThinkingMode(stored) ? stored : 'disabled';
}

function getInitialModelId(): ModelId {
  const stored = window.localStorage.getItem(MODEL_STORAGE_KEY);
  return isModelId(stored) ? stored : 'deepseek-v4-flash';
}

function isThinkingMode(value: unknown): value is ThinkingMode {
  return value === 'enabled' || value === 'disabled';
}

function isModelId(value: unknown): value is ModelId {
  return value === 'deepseek-v4-flash' || value === 'deepseek-v4-pro';
}
