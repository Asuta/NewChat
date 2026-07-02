import {
  addAgentStep,
  addConversation,
  addEvent,
  applyWorldPatch,
  createAgentRun,
  enterScene,
  finishAgentRun,
  getCurrentScene,
  getEntity,
  getEntityBundle,
  getWorldOverview,
  listAgentRuns,
  listAgentSteps,
  listRelationships,
  searchEntities,
} from './worldDb.js';
import { readFixedContextBundle } from './contextLoader.js';
import { getRuleSection, getRuleToc, searchRules } from './rulesLoader.js';

export const WORLD_AGENT_DEFAULT_MAX_STEPS = 30;
export const WORLD_AGENT_MIN_STEPS = 1;
export const WORLD_AGENT_MAX_STEPS = 100;
const WORLD_AGENT_NATIVE_TOOL_INSTRUCTION = [
  '当前后端使用 API 原生工具调用模式。',
  '你不要输出裸 JSON 决策；需要行动时通过 tool_calls 调用工具。',
  '只处理最后一条 role=user 的当前任务；更早的 user/assistant/tool 消息只是历史上下文。',
  '读取、搜索、掷骰、写库、切换场景默认静默；普通叙事、规则结果和说明直接写在 assistant 正文里。',
  '只有 NPC 实际说出口的直接对白才调用 npc_speak，并且 content 只写 NPC 说出口的话。',
].join('\n');
const WORLD_AGENT_TOOL_NAMES = new Set([
  'search_entities',
  'get_entity_bundle',
  'get_current_scene',
  'get_scene_entities',
  'get_relationships',
  'get_rule_toc',
  'search_rules',
  'get_rule_section',
  'roll_dice',
  'npc_speak',
  'enter_scene',
  'apply_world_patch',
]);
const WORLD_AGENT_TOOL_SCHEMAS = [
  createToolSchema('search_entities', '按名称、别名、全文、类型或场景搜索世界实体。', {
    query: { type: 'string', description: '搜索关键词。' },
    kind: { type: 'string', description: '可选实体类型，例如 character、scene、item。' },
    sceneId: { type: 'string', description: '可选场景实体 id。' },
    limit: { type: 'number', description: '返回数量上限。' },
  }),
  createToolSchema('get_entity_bundle', '读取单个实体详情、组件、关系和近期事件。', {
    entityId: { type: 'string', description: '目标实体 id。' },
  }, ['entityId']),
  createToolSchema('get_current_scene', '读取玩家当前所在场景及其中人物、道具、出口。', {}),
  createToolSchema('get_scene_entities', '读取指定场景中的实体。', {
    sceneId: { type: 'string', description: '场景实体 id。' },
    limit: { type: 'number', description: '返回数量上限。' },
  }, ['sceneId']),
  createToolSchema('get_relationships', '读取实体关系。', {
    entityId: { type: 'string', description: '实体 id；为空时读取全部关系。' },
    direction: { type: 'string', description: 'both、out 或 in。' },
    type: { type: 'string', description: '可选关系类型过滤。' },
  }),
  createToolSchema('get_rule_toc', '读取当前跑团规则目录。', {}),
  createToolSchema('search_rules', '按关键词、分类或标签搜索规则段落。', {
    query: { type: 'string', description: '规则搜索关键词。' },
    category: { type: 'string', description: '可选规则分类。' },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: '可选规则标签。',
    },
    limit: { type: 'number', description: '返回数量上限。' },
  }, ['query']),
  createToolSchema('get_rule_section', '读取具体规则段落正文。', {
    id: { type: 'string', description: '规则段落 id。' },
  }, ['id']),
  createToolSchema('roll_dice', '掷骰并返回随机结果、明细和总值。', {
    expression: { type: 'string', description: '骰子表达式，例如 1d20+5、1d8+3。' },
    reason: { type: 'string', description: '本次掷骰原因。' },
  }, ['expression']),
  createToolSchema('npc_speak', '让一个已存在实体以独立 NPC 对话气泡发言。', {
    npcEntityId: { type: 'string', description: 'NPC 实体 id。' },
    content: { type: 'string', description: 'NPC 实际说出口的话，不包含旁白或说话人前缀。' },
  }, ['npcEntityId', 'content']),
  createToolSchema('enter_scene', '校验出口并切换玩家当前场景。', {
    sceneId: { type: 'string', description: '目标场景实体 id，优先使用。' },
    exitId: { type: 'number', description: '当前场景 exits 中的出口关系 id。' },
  }),
  createToolSchema('apply_world_patch', '创建或修改长期世界事实。', {
    operations: {
      type: 'array',
      items: { type: 'object' },
      description: '世界变更操作数组。',
    },
    confirmedTargetIds: {
      type: 'array',
      items: { type: 'string' },
      description: '已由玩家确认的目标实体 id。',
    },
    dryRun: { type: 'boolean', description: '为 true 时只预览变更。' },
  }, ['operations']),
];

export async function runWorldAgentTask(input) {
  return runWorldAgentTaskInternal(input, {});
}

export async function runWorldAgentTaskStream(input, handlers = {}) {
  return runWorldAgentTaskInternal(input, handlers);
}

async function runWorldAgentTaskInternal(input, handlers) {
  const prompt = String(input.prompt || '').trim();
  if (!prompt) throw new Error('prompt 不能为空。');
  const taskRole = input.taskRole === 'system' ? 'system' : 'user';

  const runId = createAgentRun(prompt);
  const steps = [];
  const maxSteps = normalizeMaxSteps(input.maxSteps);
  const requestLog = { entries: [] };
  const baseContextEvents = Array.isArray(input.contextEvents)
    ? input.contextEvents
    : legacyMessagesToContextEvents(input.conversationContext);
  addConversation(taskRole, taskRole === 'user' ? 'player' : null, taskRole === 'user' ? '玩家' : '系统', prompt);
  addEvent('agent.started', 'player', null, { summary: `Agent 开始处理：${prompt}` });
  handlers.onStart?.({ runId });

  try {
    const state = {
      visibleAnswer: '',
      assistantText: '',
      stepIndex: 1,
      modelTranscript: [],
    };

    if (shouldUseNativeToolPlanner(input)) {
      return await runNativeToolPlanningLoop({
        input,
        handlers,
        prompt,
        runId,
        steps,
        requestLog,
        baseContextEvents,
        maxSteps,
        state,
      });
    }

    return await runLocalFallbackToolPlanningLoop({
      input,
      handlers,
      prompt,
      runId,
      steps,
      requestLog,
      maxSteps,
      state,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishAgentRun(runId, 'failed', null, message);
    addEvent('agent.failed', null, null, { summary: message, prompt, stepCount: steps.length });
    throw error;
  }
}

async function runLocalFallbackToolPlanningLoop({
  input,
  handlers,
  prompt,
  runId,
  steps,
  requestLog,
  maxSteps,
  state,
}) {
  for (let plannerTurn = 1; plannerTurn <= maxSteps; plannerTurn += 1) {
    const decision = planFallbackToolCall({
      prompt,
      steps,
      stepIndex: plannerTurn,
      maxSteps,
      requestLog,
    });
    if (!decision) break;

    const applied = await applyAgentDecision({
      decision,
      input,
      handlers,
      prompt,
      runId,
      steps,
      requestLog,
      state,
    });
    if (applied.response) return applied.response;
  }

  return await finishSuccessfulRun({
    runId,
    steps,
    visibleAnswer: state.visibleAnswer,
    assistantText: state.assistantText,
    fallbackText: state.visibleAnswer ? '' : summarizeAgentResult(prompt, steps),
    requestLog,
    handlers,
    signal: input.signal,
  });
}

async function runNativeToolPlanningLoop({
  input,
  handlers,
  prompt,
  runId,
  steps,
  requestLog,
  baseContextEvents,
  maxSteps,
  state,
}) {
  const apiKey = process.env.LLM_API_KEY;
  const selectedModel = normalizeModel(input.model) || String(process.env.LLM_MODEL || '').trim();
  const thinkingMode = normalizeThinkingMode(input.thinking) || normalizeThinkingMode(process.env.LLM_THINKING);
  const endpoint = `${normalizeBaseURL(process.env.LLM_BASE_URL || 'https://api.openai.com/v1')}/chat/completions`;
  const messages = createInitialPlanningMessages({
    prompt,
    contextEvents: baseContextEvents,
    modeInstruction: WORLD_AGENT_NATIVE_TOOL_INSTRUCTION,
    useNativeModelMessages: true,
  });

  while (state.stepIndex <= maxSteps) {
    const logEntry = {
      kind: 'tool-plan',
      mode: 'native-tools',
      stepIndex: state.stepIndex,
      model: selectedModel,
      thinking: thinkingMode || 'unset',
      createdAt: Date.now(),
      maxSteps,
      nativeTools: WORLD_AGENT_TOOL_SCHEMAS.map((tool) => tool.function.name),
      messages: messages.map(logModelMessage),
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
        tools: WORLD_AGENT_TOOL_SCHEMAS,
        tool_choice: 'auto',
        ...deepSeekThinkingConfig(input.thinking, selectedModel),
      }),
      signal: input.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`模型服务请求失败：${response.status}${detail ? ` ${detail}` : ''}`);
    }

    const json = await response.json();
    logEntry.usage = normalizeUsage(json.usage);
    const assistantMessage = normalizeNativeAssistantMessage(json.choices?.[0]?.message);
    logEntry.content = typeof assistantMessage.content === 'string' ? assistantMessage.content : '';
    logEntry.reasoningContentLength = typeof assistantMessage.reasoning_content === 'string'
      ? assistantMessage.reasoning_content.length
      : 0;
    logEntry.toolCalls = summarizeNativeToolCalls(assistantMessage.tool_calls);
    const assistantVisibleText = formatAssistantVisibleText(assistantMessage, thinkingMode);

    if (!assistantMessage.tool_calls.length) {
      if (assistantVisibleText || assistantMessage.reasoning_content) {
        const finalTranscript = createNativeAssistantTranscriptMessage(assistantMessage);
        messages.push(finalTranscript);
        state.modelTranscript.push(finalTranscript);
      }
      await appendAssistantVisibleText({
        text: assistantVisibleText,
        runId,
        state,
        handlers,
        signal: input.signal,
      });

      return await finishSuccessfulRun({
        runId,
        steps,
        visibleAnswer: state.visibleAnswer,
        assistantText: state.assistantText,
        requestLog,
        modelTranscript: state.modelTranscript,
        handlers,
        signal: input.signal,
      });
    }

    const assistantTranscript = createNativeAssistantTranscriptMessage(assistantMessage);
    messages.push(assistantTranscript);
    state.modelTranscript.push(assistantTranscript);
    await appendAssistantVisibleText({
      text: assistantVisibleText,
      runId,
      state,
      handlers,
      signal: input.signal,
    });

    for (const toolCall of assistantMessage.tool_calls) {
      const parsed = parseNativeToolCall(toolCall);
      const decision = parsed.ok ? parsed.toolCall : parsed.toolCall;
      const result = parsed.ok
        ? executeWorldTool(decision.tool, decision.args, prompt)
        : { ok: false, error: parsed.error };

      const toolResultForModel = compactToolResultForAgentStep(decision.tool, result);
      const toolResultMessage = createNativeToolResultMessage(toolCall, toolResultForModel);
      messages.push(toolResultMessage);
      state.modelTranscript.push(toolResultMessage);
      logEntry.toolResults = [
        ...(Array.isArray(logEntry.toolResults) ? logEntry.toolResults : []),
        {
          toolCallId: getNativeToolCallId(toolCall),
          tool: decision.tool,
          result: toolResultForModel,
        },
      ];

      const applied = await applyExecutedAgentTool({
        decision,
        result,
        input,
        handlers,
        runId,
        steps,
        requestLog,
        state,
      });
      if (applied.response) return applied.response;
      if (state.stepIndex > maxSteps) break;
    }
  }

  return await finishSuccessfulRun({
    runId,
    steps,
    visibleAnswer: state.visibleAnswer,
    assistantText: state.assistantText,
    fallbackText: state.visibleAnswer ? '' : summarizeAgentResult(prompt, steps),
    requestLog,
    modelTranscript: state.modelTranscript,
    handlers,
    signal: input.signal,
  });
}

async function applyAgentDecision({
  decision,
  input,
  handlers,
  prompt,
  runId,
  steps,
  requestLog,
  state,
}) {
  const args = isRecord(decision.args) ? decision.args : {};
  const result = executeWorldTool(decision.tool, args, prompt);
  const applied = await applyExecutedAgentTool({
    decision: { tool: decision.tool, args },
    result,
    input,
    handlers,
    runId,
    steps,
    requestLog,
    state,
  });
  if (applied.response) return applied;

  return applied;
}

async function applyExecutedAgentTool({
  decision,
  result,
  input,
  handlers,
  runId,
  steps,
  requestLog,
  state,
}) {
  const args = isRecord(decision.args) ? decision.args : {};
  const npcSpeech = createNpcSpeechEvent(decision.tool, args, result);
  const step = recordAgentStep({
    runId,
    stepIndex: state.stepIndex,
    tool: decision.tool,
    args,
    result,
    steps,
    handlers,
  });
  state.stepIndex += 1;

  if (decision.tool === 'npc_speak' && result.ok === false) {
    return {
      step,
      response: await finishSuccessfulRun({
        runId,
        steps,
        visibleAnswer: state.visibleAnswer,
        assistantText: state.assistantText,
        fallbackText: result.error || '发言失败。',
        requestLog,
        modelTranscript: state.modelTranscript,
        handlers,
        signal: input.signal,
      }),
    };
  }

  if (npcSpeech) {
    state.visibleAnswer = appendVisibleAnswer(state.visibleAnswer, npcSpeech.content);
    const event = {
      runId,
      stepIndex: step.index,
      npcEntityId: npcSpeech.npcEntityId,
      npcName: npcSpeech.npcName,
    };
    handlers.onNpcSpeechStart?.(event);
    await streamTextDeltas(
      npcSpeech.content,
      (delta) => handlers.onNpcSpeechDelta?.({ ...event, delta }),
      input.signal,
    );
    return { step, response: null };
  }

  if (isRepeatedToolFailure(steps)) {
    return {
      step,
      response: await finishSuccessfulRun({
        runId,
        steps,
        visibleAnswer: state.visibleAnswer,
        assistantText: state.assistantText,
        fallbackText: `工具连续失败，已停止本轮操作：${result.error || '未知错误'}。`,
        requestLog,
        modelTranscript: state.modelTranscript,
        handlers,
        signal: input.signal,
      }),
    };
  }

  return { step, response: null };
}

function recordAgentStep({ runId, stepIndex, tool, args, result, steps, handlers }) {
  const stepResult = compactToolResultForAgentStep(tool, result);
  const step = { index: stepIndex, tool, args, result: stepResult };
  steps.push(step);
  addAgentStep(runId, stepIndex, tool, args, stepResult);
  addEvent('agent.tool', null, null, {
    summary: formatToolSummary(tool, stepResult),
    tool,
    args,
    result: stepResult,
  });
  handlers.onStep?.({ step, steps: [...steps], runId });
  return step;
}

function compactToolResultForAgentStep(tool, result) {
  if (!isRecord(result) || result.ok === false) return result;

  if (tool === 'npc_speak') {
    return {
      ok: true,
      summary: 'OK',
    };
  }

  if (tool === 'enter_scene') {
    const scene = result.scene?.scene;
    const sceneId = typeof scene?.id === 'string' ? scene.id : '';
    const sceneName = typeof scene?.name === 'string' ? scene.name : sceneId;
    return {
      ok: true,
      scene: {
        id: sceneId,
        name: sceneName,
      },
      summary: '场景切换成功。',
    };
  }

  if (tool === 'apply_world_patch') {
    const patch = isRecord(result.patch) ? result.patch : {};
    const applied = Array.isArray(patch.applied) ? patch.applied : [];
    const dryRun = patch.dryRun === true;
    return {
      ok: true,
      dryRun,
      operationCount: applied.length,
      applied: applied.map((operation) => {
        if (!isRecord(operation)) return String(operation);
        return typeof operation.summary === 'string' && operation.summary.trim()
          ? operation.summary.trim()
          : String(operation.op || 'world_patch');
      }),
      summary: dryRun ? '变更预览成功。' : '修改成功。',
    };
  }

  return result;
}

function createNpcSpeechEvent(tool, args, result) {
  if (tool !== 'npc_speak' || !isRecord(result) || result.ok === false) return null;
  const content = String(args.content || args.text || args.message || '').trim();
  const npc = isRecord(result.npc) ? result.npc : {};
  if (!content || typeof npc.id !== 'string' || typeof npc.name !== 'string') return null;
  return {
    npcEntityId: npc.id,
    npcName: npc.name,
    content,
  };
}

async function appendAssistantVisibleText({ text, runId, state, handlers, signal }) {
  const content = String(text || '').trim();
  if (!content) return;
  state.visibleAnswer = appendVisibleAnswer(state.visibleAnswer, content);
  state.assistantText = appendVisibleAnswer(state.assistantText, content);
  handlers.onAssistantTextStart?.({ runId });
  await streamTextDeltas(content, handlers.onAssistantTextDelta, signal);
}

function formatAssistantVisibleText(message, thinkingMode) {
  const content = String(message.content || '').trim();
  if (thinkingMode !== 'enabled') return content;

  const reasoning = String(message.reasoning_content || '').trim();
  return [
    reasoning ? `思考：\n${reasoning}` : '',
    content ? `正文：\n${content}` : '',
  ].filter(Boolean).join('\n\n');
}

async function finishSuccessfulRun({
  runId,
  steps,
  visibleAnswer,
  assistantText = '',
  fallbackText = '',
  requestLog,
  modelTranscript = [],
  handlers,
  signal,
}) {
  let answer = String(visibleAnswer || '').trim();
  let assistantConversationText = String(assistantText || '').trim();
  const finalText = String(fallbackText || '').trim();

  if (finalText) {
    answer = appendVisibleAnswer(answer, finalText);
    assistantConversationText = appendVisibleAnswer(assistantConversationText, finalText);
    handlers.onAssistantTextStart?.({ runId });
    await streamTextDeltas(finalText, handlers.onAssistantTextDelta, signal);
  }

  if (!answer) {
    const emptyAnswer = '本轮没有生成可见回复。';
    answer = appendVisibleAnswer(answer, emptyAnswer);
    assistantConversationText = appendVisibleAnswer(assistantConversationText, emptyAnswer);
    handlers.onAssistantTextStart?.({ runId });
    await streamTextDeltas(emptyAnswer, handlers.onAssistantTextDelta, signal);
  }

  if (assistantConversationText) {
    addConversation('assistant', null, '世界 Agent', assistantConversationText);
  }
  finishAgentRun(runId, 'completed', answer, null);
  addEvent('agent.finished', null, null, { summary: answer, stepCount: steps.length });
  const result = {
    answer,
    runId,
    steps,
    modelTranscript,
    world: getWorldOverview(),
    requestLog,
  };
  handlers.onDone?.(result);
  return result;
}

export function executeWorldTool(tool, args, prompt = '') {
  if (tool === 'search_entities') {
    const entities = searchEntities({
      query: String(args.query || args.name || ''),
      kind: String(args.kind || ''),
      sceneId: String(args.sceneId || ''),
      limit: Number(args.limit || 12),
    });
    return {
      ok: true,
      entities,
      summary: entities.length ? `找到 ${entities.length} 个实体。` : '没有找到匹配实体。',
    };
  }

  if (tool === 'get_entity_bundle') {
    const entityId = String(args.entityId || args.id || '');
    const bundle = getEntityBundle(entityId);
    return bundle
      ? { ok: true, bundle, summary: `已读取 ${bundle.entity.name} 的实体详情。` }
      : { ok: false, error: `实体 ${entityId || '(empty)'} 不存在。` };
  }

  if (tool === 'get_current_scene') {
    return {
      ok: true,
      scene: getCurrentScene(),
      summary: '已读取当前场景。',
    };
  }

  if (tool === 'get_scene_entities') {
    const sceneId = String(args.sceneId || args.entityId || '');
    const scene = getEntity(sceneId);
    if (!scene || scene.kind !== 'scene') {
      return { ok: false, error: `场景 ${sceneId || '(empty)'} 不存在。` };
    }
    return {
      ok: true,
      scene,
      entities: searchEntities({ sceneId, limit: Number(args.limit || 40) }),
      summary: `已读取 ${scene.name} 中的实体。`,
    };
  }

  if (tool === 'get_relationships') {
    const entityId = String(args.entityId || '');
    return {
      ok: true,
      relationships: listRelationships({
        entityId,
        direction: String(args.direction || 'both'),
        type: args.type ? String(args.type) : undefined,
      }),
      summary: `已读取 ${entityId || '全部'} 的关系。`,
    };
  }

  if (tool === 'get_rule_toc') {
    return getRuleToc();
  }

  if (tool === 'search_rules') {
    return searchRules({
      query: String(args.query || ''),
      category: String(args.category || ''),
      tags: Array.isArray(args.tags) ? args.tags : [],
      limit: Number(args.limit || 8),
    });
  }

  if (tool === 'get_rule_section') {
    return getRuleSection(String(args.id || args.ruleId || ''));
  }

  if (tool === 'roll_dice') {
    return rollDice({
      expression: String(args.expression || args.dice || '1d20'),
      reason: String(args.reason || ''),
    });
  }

  if (tool === 'npc_speak') {
    const npcEntityId = String(args.npcEntityId || args.entityId || args.id || '').trim();
    const content = String(args.content || args.text || args.message || '').trim();
    if (!npcEntityId) {
      return {
        ok: false,
        error: 'npc_speak.npcEntityId 不能为空。',
      };
    }
    if (!content) {
      return {
        ok: false,
        error: 'npc_speak.content 不能为空。',
      };
    }

    const entity = getEntity(npcEntityId);
    if (!entity) {
      return {
        ok: false,
        error: `实体 ${npcEntityId} 不存在。`,
      };
    }

    addConversation('npc', entity.id, entity.name, content);
    return {
      ok: true,
      npc: {
        id: entity.id,
        name: entity.name,
      },
      summary: `${entity.name}发言成功。`,
    };
  }

  if (tool === 'enter_scene') {
    try {
      const targetSceneId = resolveEnterSceneTargetId(args);
      const scene = enterScene(targetSceneId);
      return {
        ok: true,
        scene,
        answer: `你进入了${scene.scene?.name ?? '新的场景'}。${scene.sceneComponent?.description ?? ''}`,
        summary: `玩家进入 ${scene.scene?.name ?? targetSceneId}。`,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (tool === 'apply_world_patch') {
    try {
      const operations = normalizeWorldPatchOperations(args);
      const patch = applyWorldPatch({
        operations,
        confirmedTargetIds: Array.isArray(args.confirmedTargetIds) ? args.confirmedTargetIds : [],
        dryRun: args.dryRun === true,
        prompt,
      });
      return {
        ok: true,
        patch,
        answer: args.dryRun === true ? `我已经生成变更预览：${patch.summary}` : `已写入世界数据：${patch.summary}`,
        summary: patch.summary,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    ok: false,
    error: `未知工具：${tool}`,
  };
}

function resolveEnterSceneTargetId(args) {
  const explicitSceneId = firstNonEmptyString(
    args.sceneId,
    args.targetSceneId,
    args.destinationSceneId,
    args.entityId,
  );
  if (explicitSceneId) return explicitSceneId;

  const rawExitId = args.exitId ?? args.relationshipId ?? args.id;
  const exitId = Number(rawExitId);
  if (!Number.isFinite(exitId)) return '';

  const currentScene = getCurrentScene();
  const exit = currentScene.exits?.find((item) => item.relationship?.id === exitId);
  return exit?.scene?.id ?? '';
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function getAgentHistory() {
  return listAgentRuns(12).map((run) => ({
    ...run,
    steps: listAgentSteps(run.id),
  }));
}

function createInitialPlanningMessages({ prompt, contextEvents, modeInstruction, useNativeModelMessages = false }) {
  const fixedContext = readFixedContextBundle().content;
  const events = Array.isArray(contextEvents) ? contextEvents : [];
  const messages = [
    {
      role: 'system',
      content: fixedContext,
    },
    {
      role: 'system',
      content: modeInstruction,
    },
    ...contextEventsToModelMessages(events, { useNativeModelMessages }),
  ];
  if (!hasPromptMessageEvent(events, prompt)) {
    messages.push({
      role: 'user',
      content: prompt,
    });
  }
  return messages;
}

function contextEventsToModelMessages(contextEvents, { useNativeModelMessages = false } = {}) {
  if (!Array.isArray(contextEvents)) return [];
  return contextEvents.flatMap((event) => {
    if (!isRecord(event)) return [];

    if (event.type === 'model_message') {
      if (!useNativeModelMessages) {
        const fallbackMessage = formatModelMessageEventForJsonPlanner(event.message);
        return fallbackMessage ? [fallbackMessage] : [];
      }
      const message = normalizeContextModelMessage(event.message);
      return message ? [message] : [];
    }

    if (event.type === 'message') {
      if (!['system', 'user', 'assistant'].includes(event.role) || typeof event.content !== 'string') return [];
      return [{ role: event.role, content: event.content }];
    }

    if (event.type === 'summary') {
      return [{ role: 'system', content: `对话摘要：\n${String(event.content || '')}` }];
    }

    if (event.type === 'scene_transition') {
      return [{ role: 'system', content: String(event.content || '') }];
    }

    if (event.type === 'action_result') {
      return [{
        role: 'system',
        content: [
          '以下是本地硬逻辑已经执行并写入世界数据的动作结果。它不是玩家发言。',
          `摘要：${String(event.summary || '')}`,
          `结果：${JSON.stringify(isRecord(event.result) ? event.result : {})}`,
        ].join('\n'),
      }];
    }

    if (event.type === 'agent_step') {
      return [{
        role: 'system',
        content: [
          '以下是上一轮 Agent 工具调用记录。它是旧历史的兼容上下文，不是玩家发言。',
          `工具名：${String(event.tool || '')}`,
          `参数：${JSON.stringify(isRecord(event.args) ? event.args : {})}`,
          `返回：${JSON.stringify(isRecord(event.result) ? event.result : {})}`,
        ].join('\n'),
      }];
    }

    return [];
  });
}

function formatModelMessageEventForJsonPlanner(message) {
  if (!isRecord(message)) return null;

  if (message.role === 'tool') {
    const toolCallId = typeof message.tool_call_id === 'string' ? message.tool_call_id.trim() : '';
    return {
      role: 'system',
      content: [
        '以下是上一轮原生工具返回记录。它是旧历史的兼容上下文，不是玩家发言。',
        toolCallId ? `tool_call_id：${toolCallId}` : '',
        `返回：${typeof message.content === 'string' ? message.content : ''}`,
      ].filter(Boolean).join('\n'),
    };
  }

  if (message.role !== 'assistant') return null;
  const toolCalls = normalizeContextToolCalls(message.tool_calls);
  return {
    role: 'system',
    content: [
      '以下是上一轮 Agent 原生工具调用记录。它是旧历史的兼容上下文，不是玩家发言。',
      typeof message.content === 'string' && message.content ? `助手内容：${message.content}` : '',
      toolCalls.length ? `工具调用：${JSON.stringify(summarizeNativeToolCalls(toolCalls))}` : '',
    ].filter(Boolean).join('\n'),
  };
}

function normalizeContextModelMessage(message) {
  if (!isRecord(message)) return null;
  if (message.role === 'tool') {
    const toolCallId = typeof message.tool_call_id === 'string' ? message.tool_call_id.trim() : '';
    if (!toolCallId) return null;
    return {
      role: 'tool',
      tool_call_id: toolCallId,
      content: typeof message.content === 'string' ? message.content : '',
    };
  }

  if (message.role !== 'assistant') return null;
  const transcript = {
    role: 'assistant',
    content: typeof message.content === 'string' ? message.content : '',
  };
  const toolCalls = normalizeContextToolCalls(message.tool_calls);
  if (toolCalls.length) {
    transcript.tool_calls = toolCalls;
  }
  if (typeof message.reasoning_content === 'string') {
    transcript.reasoning_content = message.reasoning_content;
  }
  return transcript;
}

function normalizeContextToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) return [];
  return toolCalls
    .map((toolCall, index) => {
      if (!isRecord(toolCall)) return null;
      const fn = isRecord(toolCall.function) ? toolCall.function : {};
      const name = typeof fn.name === 'string' ? fn.name.trim() : '';
      const args = typeof fn.arguments === 'string' ? fn.arguments : '';
      if (!name) return null;
      return {
        id: typeof toolCall.id === 'string' && toolCall.id.trim() ? toolCall.id : `tool_call_${index + 1}`,
        type: typeof toolCall.type === 'string' && toolCall.type.trim() ? toolCall.type : 'function',
        function: {
          name,
          arguments: args,
        },
      };
    })
    .filter(Boolean);
}

function planFallbackToolCall({ prompt, steps, stepIndex, maxSteps, requestLog }) {
  const decision = fallbackToolCall(prompt, steps);
  requestLog?.entries?.push({
    kind: 'tool-plan',
    mode: 'local-fallback',
    stepIndex,
    createdAt: Date.now(),
    maxSteps,
    decision,
  });
  return decision;
}

function normalizeUsage(usage) {
  return isRecord(usage) ? usage : null;
}

function createToolSchema(name, description, properties, required = []) {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties,
        required,
      },
    },
  };
}

function shouldUseNativeToolPlanner(input) {
  if (process.env.LLM_MOCK === '1') return false;
  const apiKey = process.env.LLM_API_KEY;
  const selectedModel = normalizeModel(input.model) || String(process.env.LLM_MODEL || '').trim();
  if (!apiKey || !selectedModel) return false;
  return true;
}

function normalizeMaxSteps(value) {
  if (value == null || value === '') return WORLD_AGENT_DEFAULT_MAX_STEPS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return WORLD_AGENT_DEFAULT_MAX_STEPS;
  return Math.min(WORLD_AGENT_MAX_STEPS, Math.max(WORLD_AGENT_MIN_STEPS, Math.floor(parsed)));
}

function isDeepSeekLikeModel(model) {
  return typeof model === 'string' && model.toLowerCase().includes('deepseek');
}

function normalizeNativeAssistantMessage(message) {
  const source = isRecord(message) ? message : {};
  const toolCalls = Array.isArray(source.tool_calls)
    ? source.tool_calls.map((toolCall, index) => ({
        ...toolCall,
        id: typeof toolCall?.id === 'string' && toolCall.id.trim() ? toolCall.id : `tool_call_${index + 1}`,
      }))
    : [];
  return {
    role: 'assistant',
    content: typeof source.content === 'string' ? source.content : '',
    ...(typeof source.reasoning_content === 'string' ? { reasoning_content: source.reasoning_content } : {}),
    tool_calls: toolCalls,
  };
}

function createNativeAssistantTranscriptMessage(message) {
  const transcript = {
    role: 'assistant',
    content: typeof message.content === 'string' ? message.content : '',
    tool_calls: message.tool_calls,
  };
  if (typeof message.reasoning_content === 'string') {
    transcript.reasoning_content = message.reasoning_content;
  }
  return transcript;
}

function createNativeToolResultMessage(toolCall, result) {
  return {
    role: 'tool',
    tool_call_id: getNativeToolCallId(toolCall),
    content: JSON.stringify(result),
  };
}

function parseNativeToolCall(toolCall) {
  const toolName = getNativeToolCallName(toolCall);
  const fallbackTool = toolName || 'unknown_tool';
  const rawArgs = isRecord(toolCall?.function) ? toolCall.function.arguments : toolCall?.arguments;
  const parsedArgs = parseNativeToolArguments(rawArgs);
  if (!parsedArgs.ok) {
    return {
      ok: false,
      error: `工具 ${fallbackTool} 参数不是合法 JSON：${parsedArgs.error}`,
      toolCall: {
        tool: fallbackTool,
        args: {},
      },
    };
  }

  return {
    ok: true,
    toolCall: {
      tool: WORLD_AGENT_TOOL_NAMES.has(toolName) ? toolName : fallbackTool,
      args: parsedArgs.args,
    },
  };
}

function parseNativeToolArguments(rawArgs) {
  if (rawArgs === undefined || rawArgs === null || rawArgs === '') {
    return { ok: true, args: {} };
  }
  if (isRecord(rawArgs)) {
    return { ok: true, args: rawArgs };
  }
  if (typeof rawArgs !== 'string') {
    return { ok: false, error: `arguments 类型为 ${typeof rawArgs}` };
  }
  try {
    const parsed = JSON.parse(rawArgs);
    return { ok: true, args: isRecord(parsed) ? parsed : {} };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function getNativeToolCallId(toolCall) {
  return typeof toolCall?.id === 'string' && toolCall.id.trim() ? toolCall.id : `tool_call_${Date.now()}`;
}

function getNativeToolCallName(toolCall) {
  if (typeof toolCall?.function?.name === 'string') return toolCall.function.name;
  if (typeof toolCall?.name === 'string') return toolCall.name;
  return '';
}

function summarizeNativeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) return [];
  return toolCalls.map((toolCall) => ({
    id: getNativeToolCallId(toolCall),
    name: getNativeToolCallName(toolCall),
    arguments: isRecord(toolCall?.function) ? toolCall.function.arguments : toolCall?.arguments,
  }));
}

function logModelMessage(message) {
  return {
    role: message.role,
    content: typeof message.content === 'string' ? message.content : '',
    ...(typeof message.tool_call_id === 'string' ? { toolCallId: message.tool_call_id } : {}),
    ...(typeof message.name === 'string' ? { name: message.name } : {}),
    ...(Array.isArray(message.tool_calls) ? { toolCalls: summarizeNativeToolCalls(message.tool_calls) } : {}),
    ...(typeof message.reasoning_content === 'string' ? { reasoningContentLength: message.reasoning_content.length } : {}),
  };
}

async function streamTextDeltas(text, onDelta, signal) {
  if (!onDelta) return;
  const answer = String(text || '');
  if (!answer) return;

  for (const chunk of splitAnswerChunks(answer)) {
    if (signal?.aborted) throw new Error('请求已取消。');
    onDelta(chunk);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 90));
  }
}

function splitAnswerChunks(answer) {
  const chunks = [];
  for (let index = 0; index < answer.length; index += 8) {
    chunks.push(answer.slice(index, index + 8));
  }
  return chunks.length ? chunks : ['完成。'];
}

function appendVisibleAnswer(currentAnswer, delta) {
  const current = String(currentAnswer || '').trim();
  const next = String(delta || '').trim();
  if (!next) return current;
  return current ? `${current}\n\n${next}` : next;
}

function fallbackToolCall(prompt, steps) {
  if (steps.length === 0) {
    if (/hp|血量|生命|生命值|血|还剩|剩多少|受伤|昏迷|状态/i.test(prompt)) {
      return { tool: 'search_entities', args: { query: prompt, kind: 'character', limit: 8 } };
    }
    if (/规则|攻击|命中|检定|豁免|战斗|法术|伤害|先攻|优势|劣势|护甲|ac/i.test(prompt)) {
      return { tool: 'search_rules', args: { query: prompt, limit: 5 } };
    }
    if (/当前|这里|场景|地点|在哪|哪里|有什么|出口/.test(prompt)) {
      return { tool: 'get_current_scene', args: {} };
    }
    return { tool: 'search_entities', args: { query: prompt, limit: 8 } };
  }

  const last = steps.at(-1);
  if (last?.tool === 'search_entities' && last.result?.entities?.[0]) {
    return { tool: 'get_entity_bundle', args: { entityId: last.result.entities[0].id } };
  }

  if (last?.tool === 'search_rules' && last.result?.results?.[0]) {
    return { tool: 'get_rule_section', args: { id: last.result.results[0].id } };
  }

  return null;
}

function normalizeToolCall(raw) {
  const action = isRecord(raw.action) ? raw.action : null;
  const args = isRecord(action?.args) ? action.args : isRecord(raw.args) ? raw.args : {};
  const tool = (typeof action?.tool === 'string'
    ? action.tool
    : typeof raw.tool === 'string'
      ? raw.tool
      : typeof raw.name === 'string'
        ? raw.name
        : 'unknown_tool').trim() || 'unknown_tool';

  const valid = new Set([
    'search_entities',
    'get_entity_bundle',
    'get_current_scene',
    'get_scene_entities',
    'get_relationships',
    'get_rule_toc',
    'search_rules',
    'get_rule_section',
    'roll_dice',
    'npc_speak',
    'enter_scene',
    'apply_world_patch',
  ]);
  return {
    tool: valid.has(tool) ? tool : tool,
    args,
  };
}

function rollDice({ expression, reason }) {
  const parsed = parseDiceExpression(expression);
  if (!parsed.ok) {
    return parsed;
  }

  const rolls = Array.from({ length: parsed.count }, () => 1 + Math.floor(Math.random() * parsed.sides));
  const diceTotal = rolls.reduce((sum, value) => sum + value, 0);
  const total = diceTotal + parsed.modifier;
  const modifierText = parsed.modifier > 0 ? `+${parsed.modifier}` : parsed.modifier < 0 ? String(parsed.modifier) : '';
  const normalizedExpression = `${parsed.count}d${parsed.sides}${modifierText}`;

  return {
    ok: true,
    expression: normalizedExpression,
    reason,
    count: parsed.count,
    sides: parsed.sides,
    rolls,
    diceTotal,
    modifier: parsed.modifier,
    total,
    summary: `${reason ? `${reason}：` : ''}${normalizedExpression} = ${rolls.join(' + ')}${modifierText ? ` ${modifierText}` : ''} => ${total}`,
  };
}

function parseDiceExpression(expression) {
  const normalized = String(expression || '').trim().toLowerCase().replace(/\s+/g, '');
  const match = normalized.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!match) {
    return {
      ok: false,
      error: `骰子表达式无效：${expression || '(empty)'}。请使用 1d20、1d20+5 或 2d6-1 这类格式。`,
    };
  }

  const count = Number(match[1] || 1);
  const sides = Number(match[2]);
  const modifier = Number(match[3] || 0);

  if (!Number.isInteger(count) || count < 1 || count > 20) {
    return { ok: false, error: '骰子数量必须在 1 到 20 之间。' };
  }
  if (!Number.isInteger(sides) || sides < 2 || sides > 100) {
    return { ok: false, error: '骰子面数必须在 2 到 100 之间。' };
  }
  if (!Number.isInteger(modifier) || modifier < -1000 || modifier > 1000) {
    return { ok: false, error: '骰子修正值必须在 -1000 到 1000 之间。' };
  }

  return {
    ok: true,
    count,
    sides,
    modifier,
  };
}

function isRepeatedToolFailure(steps) {
  if (steps.length < 3) return false;
  const recent = steps.slice(-3);
  return recent.every((step) => {
    const first = recent[0];
    return (
      step.tool === first.tool &&
      step.result?.ok === false &&
      first.result?.ok === false &&
      step.result?.error === first.result?.error &&
      JSON.stringify(step.args) === JSON.stringify(first.args)
    );
  });
}

function normalizeWorldPatchOperations(args) {
  if (Array.isArray(args.operations) && args.operations.length) {
    return args.operations.flatMap(normalizeWorldPatchOperation).filter(Boolean);
  }

  if (Array.isArray(args.patches) && args.patches.length) {
    return args.patches.flatMap(normalizeWorldPatchOperation).filter(Boolean);
  }

  if (Array.isArray(args.patch) && args.patch.length) {
    return args.patch.flatMap(normalizeWorldPatchOperation).filter(Boolean);
  }

  if (Array.isArray(args.ops) && args.ops.length) {
    return args.ops.flatMap(normalizeWorldPatchOperation).filter(Boolean);
  }

  if (isRecord(args.operation)) {
    const operation = normalizeWorldPatchOperation(args.operation);
    return operation ? [operation] : [];
  }

  const single = normalizeWorldPatchOperation(args);
  return single ? [single] : [];
}

function normalizeWorldPatchOperation(operation) {
  if (!isRecord(operation)) return null;

  const op = String(operation.op || operation.operation || operation.type || '').trim();
  if (
    [
      'create_entity',
      'create_owned_item',
      'set_component',
      'delete_component',
      'set_relationship',
      'delete_relationship',
      'delete_entity',
    ].includes(op)
  ) {
    return operation;
  }

  if (['replace', 'add', 'set', 'upsert'].includes(op)) {
    return normalizeJsonPatchOperation(operation);
  }

  if (operation.entityId && (operation.componentType || operation.component) && (operation.path || 'value' in operation || operation.data)) {
    return {
      op: 'set_component',
      entityId: operation.entityId,
      componentType: operation.componentType || operation.component,
      path: normalizePatchPathValue(operation.path),
      value: operation.value,
      data: operation.data,
    };
  }

  return operation;
}

function normalizeJsonPatchOperation(operation) {
  const path = normalizePatchPathValue(operation.path);
  const value = operation.value;
  if (!path.length) return operation;

  const entityComponentMatch = matchEntityComponentPath(path);
  if (entityComponentMatch) {
    return {
      op: 'set_component',
      entityId: entityComponentMatch.entityId,
      componentType: entityComponentMatch.componentType,
      path: entityComponentMatch.componentPath,
      value,
    };
  }

  if (path.length === 2 && path[0] === 'entities' && path[1] === '-' && isRecord(value)) {
    return {
      op: 'create_entity',
      entityId: String(value.id || value.entityId || '').trim() || createEntityId(value.kind, value.name),
      kind: value.kind,
      name: value.name,
      aliases: value.aliases,
      components: value.components,
    };
  }

  if (path.length === 2 && path[0] === 'relationships' && path[1] === '-' && isRecord(value)) {
    return {
      op: 'set_relationship',
      sourceEntityId: value.sourceEntityId || value.sourceId || value.source,
      targetEntityId: value.targetEntityId || value.targetId || value.target,
      relationshipType: value.relationshipType || value.relationType || value.type,
      value: value.value,
      data: isRecord(value.data) ? value.data : {},
    };
  }

  return operation;
}

function matchEntityComponentPath(path) {
  if (path.length < 4 || path[0] !== 'entities' || path[2] !== 'components') return null;
  return {
    entityId: path[1],
    componentType: path[3],
    componentPath: path.slice(4),
  };
}

function normalizePatchPathValue(path) {
  if (Array.isArray(path)) return path.map((part) => String(part).trim()).filter(Boolean);
  if (typeof path !== 'string') return [];
  return path
    .replace(/^\/+/, '')
    .split(/[/.]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function createEntityId(kind, name) {
  const safeKind = typeof kind === 'string' && kind.trim() ? kind.trim() : 'entity';
  const rawName = typeof name === 'string' && name.trim() ? name.trim() : String(Date.now());
  const safeName = rawName
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${safeKind}_${safeName || Date.now()}`;
}

function summarizeAgentResult(prompt, steps) {
  const currentScene = [...steps].reverse().find((step) => step.result?.scene)?.result.scene;
  if (currentScene) {
    const residents = currentScene.residents?.map((item) => item.name).join('、') || '暂无人物';
    const items = currentScene.items?.map((item) => item.name).join('、') || '暂无道具';
    const exits = currentScene.exits?.map((item) => item.scene.name).join('、') || '暂无出口';
    return [
      `当前场景：${currentScene.scene?.name ?? '未知'}。`,
      currentScene.sceneComponent?.description ?? '',
      `这里的人物：${residents}。`,
      `这里的道具：${items}。`,
      `可前往：${exits}。`,
    ].filter(Boolean).join('\n');
  }

  const bundle = [...steps].reverse().find((step) => step.result?.bundle)?.result.bundle;
  if (bundle) {
    const identity = bundle.components?.identity;
    const relationships = bundle.relationships?.slice(0, 6).map((relationship) => `${relationship.type}: ${relationship.sourceEntityId} -> ${relationship.targetEntityId}`).join('；');
    return [
      `${bundle.entity.name}（${bundle.entity.id}，${bundle.entity.kind}）`,
      identity?.description,
      relationships ? `相关关系：${relationships}。` : '',
    ].filter(Boolean).join('\n');
  }

  const found = [...steps].reverse().find((step) => Array.isArray(step.result?.entities))?.result.entities;
  if (found?.length) {
    return `我根据“${prompt}”找到了：${found.map((entity) => `${entity.name}(${entity.id})`).join('、')}。`;
  }

  return `我暂时没有在世界数据库里找到足够信息来回答“${prompt}”。`;
}

function formatToolSummary(tool, result) {
  return `${tool}: ${result.summary || result.error || (result.ok ? 'ok' : 'failed')}`;
}

function createAgentStepContextEvent(step, runId) {
  const stepIndex = Number.isFinite(step.stepIndex) ? step.stepIndex : Number.isFinite(step.index) ? step.index : undefined;
  return {
    type: 'agent_step',
    ...(Number.isFinite(runId) ? { runId } : {}),
    ...(Number.isFinite(stepIndex) ? { stepIndex } : {}),
    tool: step.tool,
    args: isRecord(step.args) ? step.args : {},
    result: isRecord(step.result) ? step.result : {},
  };
}

function legacyMessagesToContextEvents(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => ['system', 'user', 'assistant'].includes(message?.role) && typeof message?.content === 'string')
    .map((message) => ({
      type: 'message',
      role: message.role,
      content: message.content,
    }));
}

function hasPromptMessageEvent(contextEvents, prompt) {
  if (!Array.isArray(contextEvents)) return false;
  const latestUserMessage = [...contextEvents]
    .reverse()
    .find((event) => event?.type === 'message' && event.role === 'user' && typeof event.content === 'string');
  return latestUserMessage?.content === prompt;
}

function normalizeBaseURL(value) {
  return value.replace(/\/+$/, '');
}

function deepSeekThinkingConfig(requestThinking, model) {
  if (!isDeepSeekLikeModel(model)) return {};
  const thinking = normalizeThinkingMode(requestThinking) || normalizeThinkingMode(process.env.LLM_THINKING);
  if (thinking !== 'enabled' && thinking !== 'disabled') return {};
  return { thinking: { type: thinking } };
}

function normalizeThinkingMode(value) {
  return value === 'enabled' || value === 'disabled' ? value : null;
}

function normalizeModel(value) {
  return value === 'deepseek-v4-flash' || value === 'deepseek-v4-pro' ? value : null;
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
