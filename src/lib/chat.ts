import type {
  AgentContextEvent,
  AgentModelTranscriptMessage,
  AgentStep,
  ChatMessage,
  ContextMode,
  Conversation,
  FixedContext,
  Role,
} from '../types';

const STORAGE_KEY = 'newchat.conversations.v1';
export const DEFAULT_CONTEXT_MODE: ContextMode = 'summary-only';
export const FIXED_CONTEXT_PREFIX = '以下是固定上下文包。它来自项目根目录 context/*.md，具有最高优先级，并且不会随对话压缩或聊天清空而改变。';
export const AGENT_TOOL_CONTEXT_PREFIX = '以下是上一轮 Agent 工具调用的完整记录。它是当前对话上下文的一部分，用于延续玩家追问；不要把它当成玩家发言。';
export const SCENE_TRANSITION_CONTEXT_PREFIX = '以下是玩家在界面中主动触发的场景移动记录。它是当前对话上下文的一部分，用于判断玩家当前位置。';
export const ACTION_RESULT_CONTEXT_PREFIX = '以下是本地硬逻辑已经执行并写入世界数据的动作结果。它不是玩家发言；其中 facts 和 stateChanges 是不可重算、不可反转的事实，AI DM 只能基于它叙事并判断后续 NPC 反应。';
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

export function createSceneTransitionMessage({
  fromSceneId,
  fromSceneName,
  toSceneId,
  toSceneName,
}: NonNullable<ChatMessage['sceneTransition']>): ChatMessage {
  return {
    id: createId('scene'),
    role: 'system',
    kind: 'scene-transition',
    content: `当前玩家从 ${fromSceneName} 移动到 ${toSceneName}`,
    createdAt: Date.now(),
    status: 'done',
    sceneTransition: {
      fromSceneId,
      fromSceneName,
      toSceneId,
      toSceneName,
    },
  };
}

export function createActionResultMessage(actionResult: NonNullable<ChatMessage['actionResult']>): ChatMessage {
  return {
    id: createId('action'),
    role: 'system',
    kind: 'action-result',
    content: actionResult.summary,
    createdAt: Date.now(),
    status: 'done',
    actionResult,
  };
}

export function createAgentStepMessage(step: AgentStep, runId?: number): ChatMessage {
  return {
    id: createId('step'),
    role: 'system',
    kind: 'agent-step',
    content: formatAgentStepMessageContent(step),
    createdAt: Date.now(),
    status: 'done',
    agentRunId: runId,
    agentStep: step,
  };
}

export function createNpcSpeechMessage({
  entityId,
  name,
  content,
  status = 'done',
}: {
  entityId: string;
  name: string;
  content: string;
  status?: ChatMessage['status'];
}): ChatMessage {
  return {
    id: createId('npc'),
    role: 'assistant',
    kind: 'npc-speech',
    content,
    createdAt: Date.now(),
    status,
    npcSpeech: {
      entityId,
      name,
    },
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

export function buildModelMessages(
  conversation: Conversation,
  messages: ChatMessage[],
  fixedContext: FixedContext,
  excludedMessageId?: string,
): ModelMessage[] {
  const cleanMessages = messages.filter(
    (message) =>
      message.id !== excludedMessageId &&
      (message.role !== 'system' || message.kind === 'scene-transition' || message.kind === 'action-result') &&
      message.status !== 'streaming' &&
      (message.content.trim() || message.agentSteps?.length || message.modelTranscript?.length),
  );
  const contextMode = getConversationContextMode(conversation);
  const summary = conversation.contextSummary;
  const fixedContextMessage = getFixedContextMessage(fixedContext);
  const dynamicMessages = buildDynamicModelMessages(cleanMessages, summary, contextMode);

  return fixedContextMessage ? [fixedContextMessage, ...dynamicMessages] : dynamicMessages;
}

export function buildContextEvents(
  conversation: Conversation,
  messages: ChatMessage[],
  excludedMessageId?: string,
): AgentContextEvent[] {
  const cleanMessages = messages.filter(
    (message) =>
      message.id !== excludedMessageId &&
      (message.role !== 'system' || message.kind === 'scene-transition' || message.kind === 'action-result') &&
      message.status !== 'streaming' &&
      (message.content.trim() || message.agentSteps?.length || message.modelTranscript?.length),
  );
  return buildDynamicContextEvents(cleanMessages, conversation.contextSummary, getConversationContextMode(conversation));
}

function buildDynamicModelMessages(
  cleanMessages: ChatMessage[],
  summary: Conversation['contextSummary'],
  contextMode: ContextMode,
): ModelMessage[] {
  const agentStepLedger = buildAgentStepLedger(cleanMessages);

  if (!summary || contextMode === 'full-history') {
    return toModelMessages(cleanMessages, agentStepLedger);
  }

  const summaryMessage: ModelMessage = {
    role: 'system',
    content: `以下是此前对话的压缩摘要。请把它视为已经发生过的完整上下文，不要主动提及“摘要”二字，除非用户询问。\n\n${summary.content}`,
  };
  const summaryEndIndex = cleanMessages.findIndex((message) => message.id === summary.lastMessageId);
  if (summaryEndIndex < 0) {
    return [summaryMessage, ...toModelMessages(cleanMessages, agentStepLedger)];
  }

  const messagesAfterSummary = cleanMessages.slice(summaryEndIndex + 1);
  if (contextMode === 'summary-only') {
    return [summaryMessage, ...toModelMessages(messagesAfterSummary, agentStepLedger)];
  }

  const recentCoveredMessages = cleanMessages.slice(0, summaryEndIndex + 1).slice(-RECENT_CONTEXT_MESSAGE_LIMIT);
  return [summaryMessage, ...toModelMessages([...recentCoveredMessages, ...messagesAfterSummary], agentStepLedger)];
}

function buildDynamicContextEvents(
  cleanMessages: ChatMessage[],
  summary: Conversation['contextSummary'],
  contextMode: ContextMode,
): AgentContextEvent[] {
  const agentStepLedger = buildAgentStepLedger(cleanMessages);
  const modelTranscriptLedger = buildModelTranscriptLedger(cleanMessages);

  if (!summary || contextMode === 'full-history') {
    return toContextEvents(cleanMessages, agentStepLedger, modelTranscriptLedger);
  }

  const summaryEvent: AgentContextEvent = {
    type: 'summary',
    content: summary.content,
  };
  const summaryEndIndex = cleanMessages.findIndex((message) => message.id === summary.lastMessageId);
  if (summaryEndIndex < 0) {
    return [summaryEvent, ...toContextEvents(cleanMessages, agentStepLedger, modelTranscriptLedger)];
  }

  const messagesAfterSummary = cleanMessages.slice(summaryEndIndex + 1);
  if (contextMode === 'summary-only') {
    return [summaryEvent, ...toContextEvents(messagesAfterSummary, agentStepLedger, modelTranscriptLedger)];
  }

  const recentCoveredMessages = cleanMessages.slice(0, summaryEndIndex + 1).slice(-RECENT_CONTEXT_MESSAGE_LIMIT);
  return [summaryEvent, ...toContextEvents([...recentCoveredMessages, ...messagesAfterSummary], agentStepLedger, modelTranscriptLedger)];
}

function getFixedContextMessage(fixedContext: FixedContext): ModelMessage | null {
  const content = fixedContext.content.trim();
  if (!content) return null;

  return {
    role: 'system',
    content: `${FIXED_CONTEXT_PREFIX}\n\n${content}`,
  };
}

export function getCompactableMessages(conversation: Conversation): ChatMessage[] {
  return conversation.messages.filter(
    (message) =>
      (message.role !== 'system' || message.kind === 'scene-transition' || message.kind === 'action-result') &&
      message.status !== 'streaming' &&
      message.content.trim(),
  );
}

export function buildCompactMessages(conversation: Conversation): ModelMessage[] {
  const compactableMessages = getCompactableMessages(conversation);
  return toModelMessages(compactableMessages, new Map());
}

type AgentStepLedger = Map<number, AgentStep[]>;
type ModelTranscriptLedger = Map<number, AgentModelTranscriptMessage[]>;

function buildAgentStepLedger(messages: ChatMessage[]): AgentStepLedger {
  const ledger: AgentStepLedger = new Map();
  for (const message of messages) {
    const runId = getAgentRunId(message);
    if (message.role !== 'assistant' || runId === null || !message.agentSteps?.length || ledger.has(runId)) {
      continue;
    }
    ledger.set(runId, message.agentSteps);
  }
  return ledger;
}

function buildModelTranscriptLedger(messages: ChatMessage[]): ModelTranscriptLedger {
  const ledger: ModelTranscriptLedger = new Map();
  for (const message of messages) {
    const runId = getAgentRunId(message);
    if (message.role !== 'assistant' || runId === null || !message.modelTranscript?.length || ledger.has(runId)) {
      continue;
    }
    ledger.set(runId, message.modelTranscript);
  }
  return ledger;
}

function toModelMessages(messages: ChatMessage[], agentStepLedger: AgentStepLedger): ModelMessage[] {
  const emittedRunIds = new Set<number>();
  return messages.flatMap((message) => {
    const output: ModelMessage[] = [];
    if (message.kind === 'scene-transition') {
      output.push({
        role: 'system',
        content: formatSceneTransitionForContext(message),
      });
      return output;
    }
    if (message.kind === 'action-result') {
      output.push({
        role: 'system',
        content: formatActionResultForContext(message),
      });
      return output;
    }

    const runId = getAgentRunId(message);
    const ledgerSteps = runId === null ? null : agentStepLedger.get(runId);
    if (message.role === 'assistant' && runId !== null && ledgerSteps?.length) {
      if (!emittedRunIds.has(runId)) {
        output.push({
          role: 'system',
          content: formatAgentStepsForContext(ledgerSteps, runId),
        });
        emittedRunIds.add(runId);
      }
      return output;
    }

    if (message.role === 'assistant' && message.agentSteps?.length) {
      output.push({
        role: 'system',
        content: formatAgentStepsForContext(message.agentSteps, message.agentRunId),
      });
    }
    if (message.kind === 'npc-speech' || message.kind === 'assistant-reasoning') {
      return output;
    }
    output.push({ role: message.role, content: message.content });
    return output;
  });
}

function toContextEvents(
  messages: ChatMessage[],
  agentStepLedger: AgentStepLedger,
  modelTranscriptLedger: ModelTranscriptLedger,
): AgentContextEvent[] {
  const emittedRunIds = new Set<number>();
  return messages.flatMap((message) => {
    if (message.kind === 'scene-transition') {
      return [createSceneTransitionContextEvent(message)];
    }
    if (message.kind === 'action-result') {
      return [createActionResultContextEvent(message)];
    }

    const output: AgentContextEvent[] = [];

    const runId = getAgentRunId(message);
    const modelTranscript = runId === null ? null : modelTranscriptLedger.get(runId);
    if (message.role === 'assistant' && runId !== null && modelTranscript?.length) {
      if (!emittedRunIds.has(runId)) {
        output.push(...createModelMessageContextEvents(modelTranscript));
        emittedRunIds.add(runId);
      }
      return output;
    }

    const ledgerSteps = runId === null ? null : agentStepLedger.get(runId);
    if (message.role === 'assistant' && runId !== null && ledgerSteps?.length) {
      if (!emittedRunIds.has(runId)) {
        output.push(...createAgentStepContextEvents(ledgerSteps, runId));
        emittedRunIds.add(runId);
      }
      return output;
    }

    if (message.role === 'assistant' && message.agentSteps?.length) {
      output.push(...createAgentStepContextEvents(message.agentSteps, message.agentRunId));
    }
    if (message.kind === 'npc-speech' || message.kind === 'assistant-reasoning') {
      return output;
    }
    output.push({
      type: 'message',
      role: message.role,
      content: message.content,
    });
    return output;
  });
}

function getAgentRunId(message: ChatMessage): number | null {
  return typeof message.agentRunId === 'number' && Number.isFinite(message.agentRunId) ? message.agentRunId : null;
}

function createSceneTransitionContextEvent(message: ChatMessage): AgentContextEvent {
  const transition = message.sceneTransition;
  return {
    type: 'scene_transition',
    content: formatSceneTransitionForContext(message),
    ...(transition
      ? {
          fromSceneId: transition.fromSceneId,
          fromSceneName: transition.fromSceneName,
          toSceneId: transition.toSceneId,
          toSceneName: transition.toSceneName,
        }
      : {}),
  };
}

function createAgentStepContextEvents(steps: AgentStep[], runId?: number): AgentContextEvent[] {
  return steps.map((step, index) => {
    const stepIndex = typeof step.stepIndex === 'number' ? step.stepIndex : typeof step.index === 'number' ? step.index : index + 1;
    return {
      type: 'agent_step',
      ...(typeof runId === 'number' && Number.isFinite(runId) ? { runId } : {}),
      ...(Number.isFinite(stepIndex) ? { stepIndex } : {}),
      tool: step.tool,
      args: isRecord(step.args) ? step.args : {},
      result: isRecord(step.result) ? step.result : {},
    };
  });
}

function formatAgentStepMessageContent(step: AgentStep) {
  const result = isRecord(step.result) ? step.result : {};
  const summary = result.summary;
  if (typeof summary === 'string' && summary.trim()) return summary.trim();
  const error = result.error;
  if (typeof error === 'string' && error.trim()) return error.trim();
  const answer = result.answer;
  if (typeof answer === 'string' && answer.trim()) return answer.trim();
  return result.ok === false ? '工具调用失败。' : '已执行。';
}

function createModelMessageContextEvents(messages: AgentModelTranscriptMessage[]): AgentContextEvent[] {
  return messages.map((message) => ({
    type: 'model_message',
    message,
  }));
}

function createActionResultContextEvent(message: ChatMessage): AgentContextEvent {
  const result = message.actionResult;
  return {
    type: 'action_result',
    summary: result?.summary || message.content,
    result: result || {
      type: 'attack.resolved',
      facts: {},
      stateChanges: [],
      narrationHints: {},
      summary: message.content,
    },
  };
}

function formatActionResultForContext(message: ChatMessage): string {
  return [
    ACTION_RESULT_CONTEXT_PREFIX,
    '',
    `摘要：${message.actionResult?.summary || message.content}`,
    `完整结果：${formatJson(message.actionResult || null)}`,
  ].join('\n');
}

export function formatAgentStepsForContext(steps: AgentStep[], runId?: number): string {
  const header = [AGENT_TOOL_CONTEXT_PREFIX, runId ? `Agent Run ID: ${runId}` : null, `工具调用数量：${steps.length}`]
    .filter(Boolean)
    .join('\n');

  return [
    header,
    ...steps.map((step, index) =>
      [
        `\n[工具调用 ${index + 1}]`,
        `工具名：${step.tool}`,
        `参数：${formatJson(step.args)}`,
        `返回：${formatJson(step.result)}`,
      ].join('\n'),
    ),
  ].join('\n');
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? null, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
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

function formatSceneTransitionForContext(message: ChatMessage): string {
  const transition = message.sceneTransition;
  if (!transition) {
    return `${SCENE_TRANSITION_CONTEXT_PREFIX}\n\n场景变更：${message.content}。`;
  }
  return `${SCENE_TRANSITION_CONTEXT_PREFIX}\n\n场景变更：当前玩家从「${transition.fromSceneName}」移动到「${transition.toSceneName}」。`;
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
