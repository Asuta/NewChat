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

export const WORLD_AGENT_MAX_STEPS = 12;
const WORLD_AGENT_MAX_PARSE_REPAIRS = 2;

export async function runWorldAgentTask(input) {
  return runWorldAgentTaskInternal(input, {});
}

export async function runWorldAgentTaskStream(input, handlers = {}) {
  return runWorldAgentTaskInternal(input, handlers);
}

async function runWorldAgentTaskInternal(input, handlers) {
  const prompt = String(input.prompt || '').trim();
  if (!prompt) throw new Error('prompt 不能为空。');

  const runId = createAgentRun(prompt);
  const steps = [];
  let visibleAnswer = '';
  const requestLog = { entries: [] };
  const baseContextEvents = Array.isArray(input.contextEvents)
    ? input.contextEvents
    : legacyMessagesToContextEvents(input.conversationContext);
  addConversation('user', 'player', '玩家', prompt);
  addEvent('agent.started', 'player', null, { summary: `Agent 开始处理：${prompt}` });
  handlers.onStart?.({ runId });

  try {
    let stepIndex = 1;
    for (let plannerTurn = 1; plannerTurn <= WORLD_AGENT_MAX_STEPS; plannerTurn += 1) {
      const decision = await planNextToolCall({
        prompt,
        steps,
        model: input.model,
        thinking: input.thinking,
        contextEvents: baseContextEvents,
        runId,
        stepIndex: plannerTurn,
        requestLog,
        signal: input.signal,
      });

      if (decision.say) {
        const args = { text: decision.say };
        const result = executeWorldTool('speak', args, prompt);
        const step = recordAgentStep({
          runId,
          stepIndex,
          tool: 'speak',
          args,
          result,
          steps,
          handlers,
        });
        stepIndex += 1;

        const delta = createSpeechDelta(visibleAnswer, result.text);
        if (delta) {
          visibleAnswer = appendVisibleAnswer(visibleAnswer, delta);
          handlers.onSpeechStart?.({ runId, stepIndex: step.index });
          await streamTextDeltas(delta, handlers.onSpeechDelta, input.signal);
        }
        if (step.result?.ok === false) {
          return await finishSuccessfulRun({
            runId,
            steps,
            seedAnswer: step.result.error || '发言失败。',
            visibleAnswer,
            requestLog,
            handlers,
            signal: input.signal,
          });
        }
      }

      if (decision.tool === 'finish') {
        return await finishSuccessfulRun({
          runId,
          steps,
          seedAnswer: String(decision.args?.answer || (visibleAnswer ? '' : summarizeAgentResult(prompt, steps))),
          visibleAnswer,
          requestLog,
          handlers,
          signal: input.signal,
        });
      }

      const args = isRecord(decision.args) ? decision.args : {};
      const result = executeWorldTool(decision.tool, args, prompt);
      const step = recordAgentStep({
        runId,
        stepIndex,
        tool: decision.tool,
        args,
        result,
        steps,
        handlers,
      });
      stepIndex += 1;

      if (isRepeatedToolFailure(steps)) {
        return await finishSuccessfulRun({
          runId,
          steps,
          seedAnswer: `工具连续失败，已停止本轮操作：${result.error || '未知错误'}。`,
          visibleAnswer,
          requestLog,
          handlers,
          signal: input.signal,
        });
      }
    }

    return await finishSuccessfulRun({
      runId,
      steps,
      seedAnswer: visibleAnswer ? '' : summarizeAgentResult(prompt, steps),
      visibleAnswer,
      requestLog,
      handlers,
      signal: input.signal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishAgentRun(runId, 'failed', null, message);
    addEvent('agent.failed', null, null, { summary: message, prompt, stepCount: steps.length });
    throw error;
  }
}

function recordAgentStep({ runId, stepIndex, tool, args, result, steps, handlers }) {
  const step = { index: stepIndex, tool, args, result };
  steps.push(step);
  addAgentStep(runId, stepIndex, tool, args, result);
  addEvent('agent.tool', null, null, {
    summary: formatToolSummary(tool, result),
    tool,
    args,
    result,
  });
  handlers.onStep?.({ step, steps: [...steps], runId });
  return step;
}

async function finishSuccessfulRun({ runId, steps, seedAnswer, visibleAnswer, requestLog, handlers, signal }) {
  let answer = String(visibleAnswer || '').trim();
  const finalText = String(seedAnswer || '').trim();

  if (finalText && finalText !== answer) {
    if (answer) {
      const delta = createSpeechDelta(answer, finalText);
      if (delta) {
        answer = appendVisibleAnswer(answer, delta);
        await streamTextDeltas(delta, handlers.onFinalAnswerDelta, signal);
      }
    } else {
      answer = await streamFallbackAnswer(finalText, handlers.onFinalAnswerDelta, signal);
    }
  }

  if (!answer) {
    answer = await streamFallbackAnswer('本轮没有生成可见回复。', handlers.onFinalAnswerDelta, signal);
  }

  addConversation('assistant', null, '世界 Agent', answer);
  finishAgentRun(runId, 'completed', answer, null);
  addEvent('agent.finished', null, null, { summary: answer, stepCount: steps.length });
  const result = {
    answer,
    runId,
    steps,
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

  if (tool === 'speak') {
    const text = String(args.text || args.message || args.answer || '').trim();
    return text
      ? {
          ok: true,
          text,
          answer: text,
          summary: 'Agent 对玩家发言。',
        }
      : {
          ok: false,
          error: 'speak.text 不能为空。',
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

  if (tool === 'finish') {
    return {
      ok: true,
      done: true,
      answer: typeof args.answer === 'string' && args.answer.trim() ? args.answer.trim() : '',
      summary: 'Agent 结束本轮任务。',
    };
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

async function planNextToolCall({ prompt, steps, model, thinking, contextEvents, runId, stepIndex, requestLog, signal }) {
  if (process.env.LLM_MOCK === '1') {
    return fallbackToolCall(prompt, steps);
  }

  const apiKey = process.env.LLM_API_KEY;
  const selectedModel = normalizeModel(model) || process.env.LLM_MODEL;
  if (!apiKey || !selectedModel) {
    return fallbackToolCall(prompt, steps);
  }

  const fixedContext = readFixedContextBundle().content;
  const planningContextEvents = [
    ...(Array.isArray(contextEvents) ? contextEvents : []),
    ...steps.map((step) => createAgentStepContextEvent(step, runId)),
  ];
  const payload = {
    contextEvents: planningContextEvents,
    ...(!hasPromptMessageEvent(contextEvents, prompt) ? { task: prompt } : {}),
  };
  const messages = [
    {
      role: 'system',
      content: fixedContext,
    },
    {
      role: 'user',
      content: JSON.stringify(
        payload,
        null,
        2,
      ),
    },
  ];
  const endpoint = `${normalizeBaseURL(process.env.LLM_BASE_URL || 'https://api.openai.com/v1')}/chat/completions`;
  const thinkingMode = normalizeThinkingMode(thinking) || normalizeThinkingMode(process.env.LLM_THINKING);
  let lastContent = '';
  let lastParseError = '';

  for (let repairAttempt = 0; repairAttempt <= WORLD_AGENT_MAX_PARSE_REPAIRS; repairAttempt += 1) {
    const attemptMessages = repairAttempt === 0
      ? messages
      : [
        ...messages,
        createParseRepairMessage({
          previousContent: lastContent,
          parseError: lastParseError,
        }),
      ];
    const logEntry = {
      kind: 'tool-plan',
      stepIndex,
      model: selectedModel,
      thinking: thinkingMode,
      createdAt: Date.now(),
      ...(repairAttempt > 0 ? { parseRepairAttempt: repairAttempt } : {}),
      messages: attemptMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
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
        messages: attemptMessages,
        stream: false,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        ...deepSeekThinkingConfig(thinking),
      }),
      signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`模型服务请求失败：${response.status}${detail ? ` ${detail}` : ''}`);
    }

    const json = await response.json();
    logEntry.usage = normalizeUsage(json.usage);
    const content = json.choices?.[0]?.message?.content;
    lastContent = typeof content === 'string' ? content : '';
    logEntry.content = lastContent;

    const parseResult = parseModelToolCall(lastContent);
    if (parseResult.ok) {
      return parseResult.toolCall;
    }

    lastParseError = parseResult.error;
    logEntry.parseError = lastParseError;
  }

  throw new Error(`模型连续返回不可解析的工具规划 JSON：${lastParseError || '未知解析错误'}。`);
}

function normalizeUsage(usage) {
  return isRecord(usage) ? usage : null;
}

function parseModelToolCall(content) {
  const rawContent = String(content || '').trim();
  const normalized = stripCodeFence(rawContent).trim();
  const candidates = [normalized, extractJsonObject(normalized)].filter(Boolean);
  let parseError = '';

  for (const candidate of candidates) {
    try {
      return {
        ok: true,
        toolCall: normalizeToolCall(JSON.parse(candidate)),
      };
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    ok: false,
    error: parseError || '模型没有返回 JSON。',
  };
}

function createParseRepairMessage({ previousContent, parseError }) {
  return {
    role: 'user',
    content: JSON.stringify(
      {
        type: 'model_output_parse_error',
        instruction: '你上一条回复无法解析为工具规划 JSON。请根据 parseError 修正输出；不要解释，不要使用 Markdown，不要输出代码块，只输出一个完整 JSON 对象。',
        parseError,
        previousOutput: truncateForRepairPrompt(previousContent),
        requiredShape: {
          say: '可选。要展示给玩家的话；如果还需要先调用工具，可以省略或留空。',
          tool: '必须是一个可用工具名，例如 search_entities、get_entity_bundle、roll_dice、apply_world_patch、finish。',
          args: '必须是对象。finish 时可以为空对象。',
        },
      },
      null,
      2,
    ),
  };
}

function truncateForRepairPrompt(value) {
  const text = String(value || '');
  return text.length > 4000 ? `${text.slice(0, 4000)}\n...[已截断]` : text;
}

function extractJsonObject(content) {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) return '';
  return content.slice(start, end + 1);
}

async function streamFallbackAnswer(seedAnswer, onDelta, signal) {
  const answer = String(seedAnswer || '完成。');
  await streamTextDeltas(answer, onDelta, signal);
  return answer;
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

function createSpeechDelta(currentAnswer, text) {
  const normalized = String(text || '').trim();
  if (!normalized) return '';
  const current = String(currentAnswer || '').trim();
  if (current && normalized === current) return '';
  if (current && normalized.startsWith(current)) {
    return normalized.slice(current.length).trim();
  }
  const lastVisibleSegment = current.split(/\n{2,}/).pop()?.trim();
  if (lastVisibleSegment === normalized) return '';
  return normalized;
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

  return { tool: 'finish', args: { answer: summarizeAgentResult(prompt, steps) } };
}

function normalizeToolCall(raw) {
  const action = isRecord(raw.action) ? raw.action : null;
  const args = isRecord(action?.args) ? action.args : isRecord(raw.args) ? raw.args : {};
  const say = normalizeSay(raw.say ?? raw.speech ?? raw.message ?? raw.visibleText);
  const tool = typeof action?.tool === 'string'
    ? action.tool
    : typeof raw.tool === 'string'
      ? raw.tool
      : typeof raw.name === 'string'
        ? raw.name
        : 'finish';

  if (tool === 'speak') {
    return {
      say: normalizeSay(args.text ?? args.message ?? args.answer),
      tool: 'finish',
      args: {},
    };
  }

  if (tool === 'finish' && !args.answer && !say && (typeof args.text === 'string' || typeof args.message === 'string')) {
    return {
      say: normalizeSay(args.text ?? args.message),
      tool: 'finish',
      args: {},
    };
  }

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
    'enter_scene',
    'apply_world_patch',
    'finish',
  ]);
  return {
    say,
    tool: valid.has(tool) ? tool : 'finish',
    args,
  };
}

function normalizeSay(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
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

function stripCodeFence(content) {
  return content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
}

function normalizeBaseURL(value) {
  return value.replace(/\/+$/, '');
}

function deepSeekThinkingConfig(requestThinking) {
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
