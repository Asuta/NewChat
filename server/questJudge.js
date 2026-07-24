import {
  addEvent,
  getComponent,
  getCurrentScene,
  getEntity,
  getMeta,
  listEntities,
  listEventsAfter,
  listWorldConversationsAfter,
  setMeta,
  upsertComponent,
  withTransaction,
} from './worldDb.js';
import {
  QUEST_JUDGE_CONVERSATION_CURSOR_META_KEY,
  QUEST_JUDGE_EVENT_CURSOR_META_KEY,
  QUEST_JUDGE_INITIALIZED_META_KEY,
} from './questConfig.js';

const QUEST_JUDGE_CONVERSATION_LIMIT = 80;
const QUEST_JUDGE_EVENT_LIMIT = 100;
const QUEST_JUDGE_TOOL_NAME = 'submit_quest_judgment';
const QUEST_JUDGE_TOOL = {
  type: 'function',
  function: {
    name: QUEST_JUDGE_TOOL_NAME,
    description: '提交本轮对全部候选任务的判定。每个候选任务必须且只能出现一次。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        judgments: {
          type: 'array',
          description: '按输入候选任务逐条给出判定，不可遗漏或添加其他任务。',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              questId: { type: 'string' },
              decision: {
                type: 'string',
                enum: ['unchanged', 'progressed', 'completed', 'failed'],
              },
              progressSummary: {
                type: 'string',
                description: '合并旧进度与本轮证据后的简短事实摘要，不写计划或猜测。',
              },
              reason: {
                type: 'string',
                description: '解释为什么证据支持该判定。',
              },
              evidenceConversationIds: {
                type: 'array',
                items: { type: 'integer' },
              },
              evidenceEventIds: {
                type: 'array',
                items: { type: 'integer' },
              },
            },
            required: [
              'questId',
              'decision',
              'progressSummary',
              'reason',
              'evidenceConversationIds',
              'evidenceEventIds',
            ],
          },
        },
      },
      required: ['judgments'],
    },
  },
};

const QUEST_JUDGE_SYSTEM_PROMPT = [
  '你是剧情游戏的任务裁定器。你只负责根据“此前进度摘要”和“本轮新增证据”判定任务状态。',
  '任务描述和完成标准只是规则，不代表其中的事情已经发生；世界预设、未来剧情和角色背景也不能当作完成证据。',
  '玩家提出愿望、计划、问题或自称完成，通常只表示意图；必须由实际发生的叙事、NPC 对话或成功的世界事件证明结果。',
  'progressed 表示有真实的新进展但尚未满足全部完成标准；completed 只在完成标准已经全部满足时使用。',
  'failed 只在新增证据表明任务已经永久无法完成时使用；暂时受阻仍是 unchanged 或 progressed。',
  '每个候选任务必须且只能返回一条判定。没有新进展时保留旧进度摘要并返回 unchanged。',
  '所有事实性判定必须引用输入中真实存在的 conversation id 或 event id；不得编造证据编号。',
  `必须调用 ${QUEST_JUDGE_TOOL_NAME}，不要输出普通文本。`,
].join('\n');

export async function judgeQuestsAfterTurn({
  model = '',
  signal,
  requestLog = null,
} = {}) {
  const checkpoint = readQuestJudgeCheckpoint();
  const rawConversations = listWorldConversationsAfter(
    checkpoint.conversationCursor,
    QUEST_JUDGE_CONVERSATION_LIMIT,
  );
  const rawEvents = listEventsAfter(checkpoint.eventCursor, QUEST_JUDGE_EVENT_LIMIT);
  const nextCheckpoint = {
    conversationCursor: rawConversations.at(-1)?.id ?? checkpoint.conversationCursor,
    eventCursor: rawEvents.at(-1)?.id ?? checkpoint.eventCursor,
  };
  const conversations = rawConversations
    .filter((conversation) => ['user', 'npc', 'assistant'].includes(conversation.role))
    .map(compactConversation);
  const events = rawEvents
    .filter(isQuestEvidenceEvent)
    .map(compactEvent);
  const candidates = getActiveQuestCandidates();

  if (!rawConversations.length && !rawEvents.length) {
    return { status: 'idle', changes: [], checkpoint };
  }

  if (!candidates.length || (!conversations.length && !events.length)) {
    persistQuestJudgeCheckpoint(nextCheckpoint);
    return {
      status: 'advanced',
      changes: [],
      checkpoint: nextCheckpoint,
      reason: candidates.length ? 'no-relevant-evidence' : 'no-active-quests',
    };
  }

  const selectedModel = String(process.env.QUEST_JUDGE_MODEL || model || process.env.LLM_MODEL || '').trim();
  const apiKey = String(process.env.LLM_API_KEY || '').trim();
  if (process.env.LLM_MOCK === '1' || !apiKey || !selectedModel) {
    return {
      status: 'skipped',
      changes: [],
      checkpoint,
      reason: process.env.LLM_MOCK === '1' ? 'mock-mode' : 'model-not-configured',
    };
  }

  const scene = getCurrentScene();
  const messages = [
    { role: 'system', content: QUEST_JUDGE_SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        currentScene: scene?.scene ? {
          id: scene.scene.id,
          name: scene.scene.name,
        } : null,
        candidateQuests: candidates.map((quest) => ({
          id: quest.id,
          title: quest.title,
          description: quest.description,
          completionCriteria: quest.completionCriteria,
          previousProgressSummary: quest.progressSummary,
        })),
        newEvidence: {
          conversations,
          events,
        },
      }),
    },
  ];
  const endpoint = `${normalizeBaseURL(process.env.LLM_BASE_URL || 'https://api.openai.com/v1')}/chat/completions`;
  const logEntry = {
    kind: 'quest-judgment',
    model: selectedModel,
    createdAt: Date.now(),
    candidateQuestIds: candidates.map((quest) => quest.id),
    conversationIds: conversations.map((conversation) => conversation.id),
    eventIds: events.map((event) => event.id),
  };
  requestLog?.entries?.push(logEntry);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: selectedModel,
      messages,
      stream: false,
      tools: [QUEST_JUDGE_TOOL],
      tool_choice: {
        type: 'function',
        function: { name: QUEST_JUDGE_TOOL_NAME },
      },
      ...(isDeepSeekLikeModel(selectedModel) ? { thinking: { type: 'disabled' } } : {}),
    }),
    signal,
  });

  if (!response.ok) {
    const detail = truncateText(await response.text().catch(() => ''), 600);
    logEntry.error = `${response.status}${detail ? ` ${detail}` : ''}`;
    throw new Error(`任务判定模型请求失败：${logEntry.error}`);
  }

  const json = await response.json();
  logEntry.usage = isRecord(json.usage) ? json.usage : null;
  const toolArguments = readQuestJudgmentToolArguments(json);
  const judgments = validateQuestJudgments(toolArguments, candidates, conversations, events);
  const applied = applyQuestJudgments(judgments, nextCheckpoint);
  logEntry.decisions = judgments.map(({ questId, decision }) => ({ questId, decision }));
  return {
    status: 'judged',
    changes: applied,
    checkpoint: nextCheckpoint,
  };
}

function getActiveQuestCandidates() {
  return listEntities({ kind: 'quest' }).map((entity) => {
    const data = getComponent(entity.id, 'quest');
    if (!data || data.judgeEnabled !== true || data.status !== 'active') return null;
    return {
      id: entity.id,
      title: data.title || entity.name,
      description: data.description || '',
      completionCriteria: data.completionCriteria || '',
      progressSummary: data.progressSummary || '',
    };
  }).filter(Boolean).sort((left, right) => left.id.localeCompare(right.id));
}

function compactConversation(conversation) {
  return {
    id: conversation.id,
    role: conversation.role,
    speakerId: conversation.speakerId,
    speakerName: conversation.speakerName,
    content: truncateText(conversation.content, 1600),
  };
}

function compactEvent(event) {
  return {
    id: event.id,
    type: event.type,
    actorId: event.actorId,
    targetId: event.targetId,
    payload: truncateText(JSON.stringify(event.payload ?? {}), 1800),
  };
}

function isQuestEvidenceEvent(event) {
  return !event.type.startsWith('agent.')
    && !event.type.startsWith('quest.')
    && event.type !== 'world.seeded';
}

function readQuestJudgmentToolArguments(json) {
  const message = json?.choices?.[0]?.message;
  const toolCall = Array.isArray(message?.tool_calls)
    ? message.tool_calls.find((candidate) => candidate?.function?.name === QUEST_JUDGE_TOOL_NAME)
    : null;
  if (!toolCall) {
    throw new Error('任务判定模型没有调用规定的提交工具。');
  }

  const rawArguments = toolCall.function?.arguments;
  if (isRecord(rawArguments)) return rawArguments;
  if (typeof rawArguments !== 'string' || !rawArguments.trim()) {
    throw new Error('任务判定模型返回了空参数。');
  }
  try {
    return JSON.parse(rawArguments);
  } catch {
    throw new Error('任务判定模型返回的工具参数不是有效 JSON。');
  }
}

function validateQuestJudgments(input, candidates, conversations, events) {
  if (!isRecord(input) || !Array.isArray(input.judgments)) {
    throw new Error('任务判定结果缺少 judgments 数组。');
  }

  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const conversationIds = new Set(conversations.map((conversation) => conversation.id));
  const eventIds = new Set(events.map((event) => event.id));
  const seenQuestIds = new Set();
  const judgments = input.judgments.map((judgment) => {
    if (!isRecord(judgment)) throw new Error('任务判定项必须是对象。');
    const questId = String(judgment.questId || '').trim();
    if (!candidateIds.has(questId)) throw new Error(`任务判定包含非候选任务：${questId || '(empty)'}`);
    if (seenQuestIds.has(questId)) throw new Error(`任务判定重复包含任务：${questId}`);
    seenQuestIds.add(questId);

    const decision = String(judgment.decision || '').trim();
    if (!['unchanged', 'progressed', 'completed', 'failed'].includes(decision)) {
      throw new Error(`任务 ${questId} 的 decision 无效。`);
    }
    const evidenceConversationIds = normalizeEvidenceIds(
      judgment.evidenceConversationIds,
      conversationIds,
      `${questId}.evidenceConversationIds`,
    );
    const evidenceEventIds = normalizeEvidenceIds(
      judgment.evidenceEventIds,
      eventIds,
      `${questId}.evidenceEventIds`,
    );
    if (decision !== 'unchanged' && !evidenceConversationIds.length && !evidenceEventIds.length) {
      throw new Error(`任务 ${questId} 的 ${decision} 判定没有引用任何本轮证据。`);
    }

    return {
      questId,
      decision,
      progressSummary: requireShortText(judgment.progressSummary, `${questId}.progressSummary`, 600),
      reason: requireShortText(judgment.reason, `${questId}.reason`, 600),
      evidenceConversationIds,
      evidenceEventIds,
    };
  });

  if (seenQuestIds.size !== candidateIds.size) {
    const missing = [...candidateIds].filter((questId) => !seenQuestIds.has(questId));
    throw new Error(`任务判定遗漏候选任务：${missing.join(', ')}`);
  }
  return judgments;
}

function normalizeEvidenceIds(input, allowedIds, fieldName) {
  if (!Array.isArray(input)) throw new Error(`${fieldName} 必须是数组。`);
  const ids = [...new Set(input.map((value) => Number(value)))];
  if (ids.some((id) => !Number.isInteger(id) || !allowedIds.has(id))) {
    throw new Error(`${fieldName} 引用了不存在的本轮证据。`);
  }
  return ids;
}

function applyQuestJudgments(judgments, checkpoint) {
  return withTransaction(() => {
    const changes = [];
    for (const judgment of judgments) {
      if (judgment.decision === 'unchanged') continue;
      const entity = getEntity(judgment.questId);
      const current = getComponent(judgment.questId, 'quest');
      if (!entity || !current || current.status !== 'active' || current.judgeEnabled !== true) {
        throw new Error(`任务 ${judgment.questId} 在写入前已不再处于可判定状态。`);
      }

      const nextStatus = judgment.decision === 'completed'
        ? 'completed'
        : judgment.decision === 'failed'
          ? 'failed'
          : 'active';
      const next = {
        ...current,
        status: nextStatus,
        phaseStatus: nextStatus === 'active' ? current.phaseStatus : nextStatus,
        progressSummary: judgment.progressSummary,
        lastJudgment: {
          decision: judgment.decision,
          reason: judgment.reason,
          evidenceConversationIds: judgment.evidenceConversationIds,
          evidenceEventIds: judgment.evidenceEventIds,
          judgedAt: new Date().toISOString(),
        },
      };
      upsertComponent(judgment.questId, 'quest', next);
      syncLinkedQuestObjectives(judgment.questId, nextStatus);

      const activated = judgment.decision === 'completed'
        ? activateFollowUpQuests(current.onComplete?.activateQuestIds)
        : [];
      const unlockedText = activated.length
        ? `，已解锁“${activated.map((quest) => quest.title).join('”“')}”`
        : '';
      const eventType = `quest.${judgment.decision}`;
      const summary = judgment.decision === 'completed'
        ? `任务完成：“${next.title}”${unlockedText}。`
        : judgment.decision === 'failed'
          ? `任务失败：“${next.title}”。`
          : `任务进展：“${next.title}”——${judgment.progressSummary}`;
      const event = addEvent(eventType, 'player', judgment.questId, {
        questId: judgment.questId,
        title: next.title,
        status: nextStatus,
        summary,
        progressSummary: judgment.progressSummary,
        reason: judgment.reason,
        evidenceConversationIds: judgment.evidenceConversationIds,
        evidenceEventIds: judgment.evidenceEventIds,
        activatedQuestIds: activated.map((quest) => quest.id),
      });
      changes.push({
        eventId: event.id,
        questId: judgment.questId,
        title: next.title,
        decision: judgment.decision,
        progressSummary: judgment.progressSummary,
        activatedQuestIds: activated.map((quest) => quest.id),
      });
    }

    persistQuestJudgeCheckpoint(checkpoint);
    return changes;
  });
}

function activateFollowUpQuests(questIds) {
  if (!Array.isArray(questIds)) return [];
  const activated = [];
  for (const questId of [...new Set(questIds.filter((value) => typeof value === 'string' && value))]) {
    const entity = getEntity(questId);
    const current = getComponent(questId, 'quest');
    if (!entity || !current || current.status !== 'inactive') continue;
    const next = {
      ...current,
      status: 'active',
      phaseStatus: 'available',
      questLogVisible: true,
    };
    upsertComponent(questId, 'quest', next);
    syncLinkedQuestObjectives(questId, 'active');
    addEvent('quest.activated', 'player', questId, {
      questId,
      title: next.title || entity.name,
      status: 'active',
      summary: `新任务已解锁：“${next.title || entity.name}”。`,
    });
    activated.push({ id: questId, title: next.title || entity.name });
  }
  return activated;
}

function syncLinkedQuestObjectives(questId, status) {
  for (const parentEntity of listEntities({ kind: 'quest' })) {
    const parentQuest = getComponent(parentEntity.id, 'quest');
    if (!parentQuest || !Array.isArray(parentQuest.objectives)) continue;

    let changed = false;
    const objectives = parentQuest.objectives.map((objective) => {
      if (!isRecord(objective) || objective.questId !== questId || objective.status === status) {
        return objective;
      }
      changed = true;
      return { ...objective, status };
    });
    if (changed) {
      upsertComponent(parentEntity.id, 'quest', { ...parentQuest, objectives });
    }
  }
}

function readQuestJudgeCheckpoint() {
  return {
    conversationCursor: readCursor(QUEST_JUDGE_CONVERSATION_CURSOR_META_KEY),
    eventCursor: readCursor(QUEST_JUDGE_EVENT_CURSOR_META_KEY),
  };
}

function persistQuestJudgeCheckpoint(checkpoint) {
  setMeta(QUEST_JUDGE_CONVERSATION_CURSOR_META_KEY, String(checkpoint.conversationCursor));
  setMeta(QUEST_JUDGE_EVENT_CURSOR_META_KEY, String(checkpoint.eventCursor));
  setMeta(QUEST_JUDGE_INITIALIZED_META_KEY, 'ready');
}

function readCursor(key) {
  const value = Number(getMeta(key, '0'));
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function requireShortText(value, fieldName, maxLength) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${fieldName} 不能为空。`);
  return truncateText(text, maxLength);
}

function truncateText(value, maxLength) {
  const text = String(value || '');
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function normalizeBaseURL(value) {
  return String(value || '').replace(/\/+$/, '');
}

function isDeepSeekLikeModel(model) {
  return model.toLowerCase().includes('deepseek');
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
