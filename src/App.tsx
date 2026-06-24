import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatThread } from './components/ChatThread';
import { Composer } from './components/Composer';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import {
  buildModelMessages,
  createConversation,
  createMessage,
  getCompactableMessages,
  getConversationContextMode,
  getInitialConversations,
  saveConversations,
  titleFromMessage,
} from './lib/chat';
import type { ChatMessage, ContextMode, Conversation, HealthState, ModelId } from './types';
import type { ThinkingMode } from './types';

const THINKING_MODE_STORAGE_KEY = 'newchat.thinkingMode.v1';
const MODEL_STORAGE_KEY = 'newchat.model.v1';

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(getInitialConversations);
  const [activeId, setActiveId] = useState(() => conversations[0]?.id || '');
  const [health, setHealth] = useState<HealthState | null>(null);
  const [modelId, setModelId] = useState<ModelId>(getInitialModelId);
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>(getInitialThinkingMode);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
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
  }, []);

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
    if (!activeConversation || isStreaming || isCompressing) return;

    const userMessage = createMessage('user', content);
    const assistantMessage = createMessage('assistant', '', 'streaming');
    const shouldRename = activeConversation.messages.length === 0 && activeConversation.title === '新对话';
    const nextMessages = [...activeConversation.messages, userMessage, assistantMessage];
    const requestMessages = buildModelMessages(activeConversation, nextMessages, assistantMessage.id);

    updateActiveConversation((conversation) => ({
      ...conversation,
      title: shouldRename ? titleFromMessage(content) : conversation.title,
      updatedAt: Date.now(),
      messages: nextMessages,
    }));

    setError(null);
    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          thinking: thinkingMode,
          messages: requestMessages,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const message = await response.text();
        throw new Error(message || `请求失败：${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        assistantContent += decoder.decode(value, { stream: true });
        updateAssistantMessage(assistantMessage.id, assistantContent, 'streaming');
      }

      updateAssistantMessage(assistantMessage.id, assistantContent || '模型没有返回内容。', 'done');
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

  function updateAssistantMessage(messageId: string, content: string, status: ChatMessage['status']) {
    updateActiveConversation((conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
      messages: conversation.messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              content,
              status,
            }
          : message,
      ),
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
          messages: compactableMessages.map((message) => ({ role: message.role, content: message.content })),
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
          canCompress={getCompactableMessages(activeConversation).length > 0}
          modelId={modelId}
          onModelChange={setModelId}
          thinkingMode={thinkingMode}
          onThinkingModeChange={setThinkingMode}
          contextMode={getConversationContextMode(activeConversation)}
          onContextModeChange={updateContextMode}
          onCompress={compactConversation}
        />
        <ChatThread conversation={activeConversation} error={error} />
        <Composer isStreaming={isStreaming} isDisabled={isCompressing} onSend={sendMessage} onStop={stopStreaming} />
      </section>
    </main>
  );
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
