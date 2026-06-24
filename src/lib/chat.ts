import type { ChatMessage, ContextMode, Conversation, Role } from '../types';

const STORAGE_KEY = 'newchat.conversations.v1';
export const DEFAULT_CONTEXT_MODE: ContextMode = 'summary-only';
export const FIXED_CONTEXT_PREFIX = '以下是本会话的固定上下文。它具有最高优先级，并且不会随对话压缩或聊天清空而改变。';
const RECENT_CONTEXT_MESSAGE_LIMIT = 6;

export interface ModelMessage {
  role: Role;
  content: string;
}

export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

export function createMessage(role: ChatMessage['role'], content: string, status: ChatMessage['status'] = 'done'): ChatMessage {
  return {
    id: createId('msg'),
    role,
    content,
    createdAt: Date.now(),
    status,
  };
}

export function createConversation(title = '新对话'): Conversation {
  const now = Date.now();
  return {
    id: createId('conv'),
    title,
    createdAt: now,
    updatedAt: now,
    contextMode: DEFAULT_CONTEXT_MODE,
    messages: [],
  };
}

export function getInitialConversations(): Conversation[] {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Conversation[];
      if (Array.isArray(parsed) && parsed.length) {
        return parsed;
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  const now = Date.now();
  return [
    {
      id: createId('conv'),
      title: '如何优化 Python 代码性能',
      createdAt: now - 1000 * 60 * 24,
      updatedAt: now - 1000 * 60 * 3,
      messages: [
        createSeedMessage('user', '在 Python 中，有哪些常用的方法可以提升代码性能？', now - 1000 * 60 * 5),
        createSeedMessage(
          'assistant',
          '可以从选择合适的数据结构、减少重复计算、使用生成器、优化热点函数、避免不必要的全局变量访问，以及用 cProfile 等工具定位瓶颈入手。\n\n如果你有具体代码片段，我可以按场景给出更有针对性的优化建议。',
          now - 1000 * 60 * 4,
        ),
      ],
    },
    emptyConversation('快速排序算法解释', now - 1000 * 60 * 60),
    emptyConversation('Docker 常用命令整理', now - 1000 * 60 * 90),
  ];
}

export function saveConversations(conversations: Conversation[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

export function titleFromMessage(content: string) {
  const compact = content.replace(/\s+/g, ' ').trim();
  return compact.length > 18 ? `${compact.slice(0, 18)}...` : compact || '新对话';
}

export function getConversationContextMode(conversation: Conversation): ContextMode {
  return conversation.contextMode || DEFAULT_CONTEXT_MODE;
}

export function buildModelMessages(conversation: Conversation, messages: ChatMessage[], excludedMessageId?: string): ModelMessage[] {
  const cleanMessages = messages.filter(
    (message) =>
      message.id !== excludedMessageId &&
      message.role !== 'system' &&
      message.status !== 'streaming' &&
      message.content.trim(),
  );
  const contextMode = getConversationContextMode(conversation);
  const summary = conversation.contextSummary;
  const fixedContextMessage = getFixedContextMessage(conversation);
  const dynamicMessages = buildDynamicModelMessages(cleanMessages, summary, contextMode);

  return fixedContextMessage ? [fixedContextMessage, ...dynamicMessages] : dynamicMessages;
}

function buildDynamicModelMessages(
  cleanMessages: ChatMessage[],
  summary: Conversation['contextSummary'],
  contextMode: ContextMode,
): ModelMessage[] {
  if (!summary || contextMode === 'full-history') {
    return toModelMessages(cleanMessages);
  }

  const summaryMessage: ModelMessage = {
    role: 'system',
    content: `以下是此前对话的压缩摘要。请把它视为已经发生过的完整上下文，不要主动提及“摘要”二字，除非用户询问。\n\n${summary.content}`,
  };
  const summaryEndIndex = cleanMessages.findIndex((message) => message.id === summary.lastMessageId);
  if (summaryEndIndex < 0) {
    return [summaryMessage, ...toModelMessages(cleanMessages)];
  }

  const messagesAfterSummary = cleanMessages.slice(summaryEndIndex + 1);
  if (contextMode === 'summary-only') {
    return [summaryMessage, ...toModelMessages(messagesAfterSummary)];
  }

  const recentCoveredMessages = cleanMessages.slice(0, summaryEndIndex + 1).slice(-RECENT_CONTEXT_MESSAGE_LIMIT);
  return [summaryMessage, ...toModelMessages(recentCoveredMessages), ...toModelMessages(messagesAfterSummary)];
}

function getFixedContextMessage(conversation: Conversation): ModelMessage | null {
  const content = conversation.fixedContext?.content.trim();
  if (!content) return null;

  return {
    role: 'system',
    content: `${FIXED_CONTEXT_PREFIX}\n\n${content}`,
  };
}

export function getCompactableMessages(conversation: Conversation): ChatMessage[] {
  return conversation.messages.filter(
    (message) => message.role !== 'system' && message.status !== 'streaming' && message.content.trim(),
  );
}

function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

function emptyConversation(title: string, updatedAt: number): Conversation {
  return {
    id: createId('conv'),
    title,
    createdAt: updatedAt,
    updatedAt,
    contextMode: DEFAULT_CONTEXT_MODE,
    messages: [],
  };
}

function createSeedMessage(role: ChatMessage['role'], content: string, createdAt: number): ChatMessage {
  return {
    id: createId('msg'),
    role,
    content,
    createdAt,
    status: 'done',
  };
}
