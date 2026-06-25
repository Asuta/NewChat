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
  const requestLog = { entries: [] };
  addConversation('user', 'player', '玩家', prompt);
  addEvent('agent.started', 'player', null, { summary: `Agent 开始处理：${prompt}` });
  handlers.onStart?.({ runId });

  try {
    for (let stepIndex = 1; stepIndex <= WORLD_AGENT_MAX_STEPS; stepIndex += 1) {
      const call = await planNextToolCall({
        prompt,
        steps,
        model: input.model,
        thinking: input.thinking,
        conversationContext: input.conversationContext,
        stepIndex,
        requestLog,
        signal: input.signal,
      });
      const args = isRecord(call.args) ? call.args : {};
      const result = executeWorldTool(call.tool, args, prompt);
      const step = { index: stepIndex, tool: call.tool, args, result };
      steps.push(step);
      addAgentStep(runId, stepIndex, call.tool, args, result);
      addEvent('agent.tool', null, null, {
        summary: formatToolSummary(call.tool, result),
        tool: call.tool,
        args,
        result,
      });
      handlers.onStep?.({ step, steps: [...steps], runId });

      if (isRepeatedToolFailure(steps)) {
        return await finishSuccessfulRun({
          prompt,
          runId,
          steps,
          model: input.model,
          thinking: input.thinking,
          conversationContext: input.conversationContext,
          seedAnswer: `工具连续失败，已停止本轮操作：${result.error || '未知错误'}。`,
          requestLog,
          handlers,
          signal: input.signal,
        });
      }

      if (call.tool === 'finish' || result.done === true) {
        return await finishSuccessfulRun({
          prompt,
          runId,
          steps,
          model: input.model,
          thinking: input.thinking,
          conversationContext: input.conversationContext,
          seedAnswer: String(result.answer || summarizeAgentResult(prompt, steps)),
          requestLog,
          handlers,
          signal: input.signal,
        });
      }
    }

    return await finishSuccessfulRun({
      prompt,
      runId,
      steps,
      model: input.model,
      thinking: input.thinking,
      conversationContext: input.conversationContext,
      seedAnswer: summarizeAgentResult(prompt, steps),
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

async function finishSuccessfulRun({ prompt, runId, steps, model, thinking, conversationContext, seedAnswer, requestLog, handlers, signal }) {
  const answer = await createFinalAnswer({
    prompt,
    steps,
    model,
    thinking,
    conversationContext,
    seedAnswer,
    onDelta: handlers.onFinalAnswerDelta,
    signal,
  });
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

  if (tool === 'enter_scene') {
    try {
      const scene = enterScene(String(args.sceneId || ''));
      return {
        ok: true,
        done: true,
        scene,
        answer: `你进入了${scene.scene?.name ?? '新的场景'}。${scene.sceneComponent?.description ?? ''}`,
        summary: `玩家进入 ${scene.scene?.name ?? args.sceneId}。`,
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
        done: args.dryRun !== true,
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
      answer: String(args.answer || '完成。'),
      summary: 'Agent 输出最终答复。',
    };
  }

  return {
    ok: false,
    error: `未知工具：${tool}`,
  };
}

export function getAgentHistory() {
  return listAgentRuns(12).map((run) => ({
    ...run,
    steps: listAgentSteps(run.id),
  }));
}

async function planNextToolCall({ prompt, steps, model, thinking, conversationContext, stepIndex, requestLog, signal }) {
  if (process.env.LLM_MOCK === '1') {
    return fallbackToolCall(prompt, steps);
  }

  const apiKey = process.env.LLM_API_KEY;
  const selectedModel = normalizeModel(model) || process.env.LLM_MODEL;
  if (!apiKey || !selectedModel) {
    return fallbackToolCall(prompt, steps);
  }

  const fixedContext = readFixedContextBundle().content;
  const messages = [
    {
      role: 'system',
      content: fixedContext,
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          task: prompt,
          conversationContext: Array.isArray(conversationContext) ? conversationContext.slice(-10) : [],
          world: shrinkWorld(getWorldOverview()),
          previousSteps: steps.map((step) => ({
            index: step.index,
            tool: step.tool,
            args: step.args,
            result: shrinkResult(step.result),
          })),
        },
        null,
        2,
      ),
    },
  ];
  requestLog?.entries?.push({
    stepIndex,
    model: selectedModel,
    thinking: normalizeThinkingMode(thinking) || normalizeThinkingMode(process.env.LLM_THINKING),
    createdAt: Date.now(),
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  });

  const response = await fetch(`${normalizeBaseURL(process.env.LLM_BASE_URL || 'https://api.openai.com/v1')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: selectedModel,
      messages,
      stream: false,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      ...deepSeekThinkingConfig(thinking),
    }),
    signal,
  });

  if (!response.ok) {
    return fallbackToolCall(prompt, steps);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  return normalizeToolCall(JSON.parse(stripCodeFence(String(content || '{}'))));
}

async function createFinalAnswer({ prompt, steps, model, thinking, conversationContext, seedAnswer, onDelta, signal }) {
  if (process.env.LLM_MOCK === '1') {
    return await streamFallbackAnswer(seedAnswer, onDelta, signal);
  }

  const apiKey = process.env.LLM_API_KEY;
  const selectedModel = normalizeModel(model) || process.env.LLM_MODEL;
  if (!apiKey || !selectedModel) {
    return await streamFallbackAnswer(seedAnswer, onDelta, signal);
  }

  const messages = buildFinalAnswerMessages({ prompt, steps, conversationContext, seedAnswer });
  try {
    if (onDelta) {
      const answer = await streamFinalAnswerFromModel({ apiKey, selectedModel, messages, thinking, onDelta, signal });
      return normalizeFinalAnswer(answer) || seedAnswer;
    }
    const answer = await fetchFinalAnswerFromModel({ apiKey, selectedModel, messages, thinking, signal });
    return normalizeFinalAnswer(answer) || seedAnswer;
  } catch {
    return await streamFallbackAnswer(seedAnswer, onDelta, signal);
  }
}

function buildFinalAnswerMessages({ prompt, steps, conversationContext, seedAnswer }) {
  return [
    {
      role: 'system',
      content:
        '你是中文游戏世界 Agent。请根据工具调用结果给玩家一个自然、简洁、可继续互动的最终答复。只输出给玩家看的中文正文，不要输出 JSON、Markdown 代码块、内部工具名或调试过程；如果工具结果包含世界变化，请直接描述玩家可感知的结果。',
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          task: prompt,
          conversationContext: Array.isArray(conversationContext) ? conversationContext.slice(-10) : [],
          world: shrinkWorld(getWorldOverview()),
          toolSteps: steps.map((step) => ({
            index: step.index,
            tool: step.tool,
            args: step.args,
            result: shrinkResult(step.result),
          })),
          fallbackAnswer: seedAnswer,
        },
        null,
        2,
      ),
    },
  ];
}

function normalizeFinalAnswer(answer) {
  const content = String(answer || '').trim();
  if (!content) return '';

  const stripped = stripCodeFence(content);
  try {
    const parsed = JSON.parse(stripped);
    if (isRecord(parsed)) {
      const directAnswer = parsed.answer;
      if (typeof directAnswer === 'string' && directAnswer.trim()) return directAnswer.trim();
      const argsAnswer = isRecord(parsed.args) ? parsed.args.answer : null;
      if (typeof argsAnswer === 'string' && argsAnswer.trim()) return argsAnswer.trim();
    }
  } catch {
    // Keep natural-language answers as-is.
  }

  return content;
}

async function fetchFinalAnswerFromModel({ apiKey, selectedModel, messages, thinking, signal }) {
  const response = await fetch(`${normalizeBaseURL(process.env.LLM_BASE_URL || 'https://api.openai.com/v1')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: selectedModel,
      messages,
      stream: false,
      temperature: 0.4,
      ...deepSeekThinkingConfig(thinking),
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`最终回答生成失败：${response.status}`);
  }

  const json = await response.json();
  const answer = json.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    throw new Error('最终回答为空。');
  }
  return answer;
}

async function streamFinalAnswerFromModel({ apiKey, selectedModel, messages, thinking, onDelta, signal }) {
  const response = await fetch(`${normalizeBaseURL(process.env.LLM_BASE_URL || 'https://api.openai.com/v1')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: selectedModel,
      messages,
      stream: true,
      temperature: 0.4,
      ...deepSeekThinkingConfig(thinking),
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`最终回答流式生成失败：${response.status}`);
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = '';
  let answer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload) continue;
      if (payload === '[DONE]') return answer.trim();

      const json = JSON.parse(payload);
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) {
        answer += delta;
        onDelta(delta);
      }
    }
  }

  return answer.trim();
}

async function streamFallbackAnswer(seedAnswer, onDelta, signal) {
  const answer = String(seedAnswer || '完成。');
  if (!onDelta) return answer;

  for (const chunk of splitAnswerChunks(answer)) {
    if (signal?.aborted) throw new Error('请求已取消。');
    onDelta(chunk);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 90));
  }
  return answer;
}

function splitAnswerChunks(answer) {
  const chunks = [];
  for (let index = 0; index < answer.length; index += 8) {
    chunks.push(answer.slice(index, index + 8));
  }
  return chunks.length ? chunks : ['完成。'];
}

function fallbackToolCall(prompt, steps) {
  if (steps.length === 0) {
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
  const tool = typeof raw.tool === 'string' ? raw.tool : typeof raw.name === 'string' ? raw.name : 'finish';
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
    tool: valid.has(tool) ? tool : 'finish',
    args: isRecord(raw.args) ? raw.args : raw,
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

function shrinkWorld(world) {
  return {
    counts: world.counts,
    currentScene: {
      scene: world.currentScene.scene,
      description: world.currentScene.sceneComponent?.description,
      residents: world.currentScene.residents,
      items: world.currentScene.items,
      exits: world.currentScene.exits.map((exit) => exit.scene),
    },
  };
}

function shrinkResult(result) {
  const text = JSON.stringify(result);
  if (text.length <= 2200) return result;
  return {
    ok: result.ok,
    summary: result.summary,
    error: result.error,
    entities: result.entities?.slice?.(0, 8),
    scene: result.scene
      ? {
          scene: result.scene.scene,
          residents: result.scene.residents,
          items: result.scene.items,
          exits: result.scene.exits?.map((exit) => exit.scene),
        }
      : undefined,
    bundle: result.bundle
      ? {
          entity: result.bundle.entity,
          aliases: result.bundle.aliases,
          components: {
            identity: result.bundle.components.identity,
            scene: result.bundle.components.scene,
            status: result.bundle.components.status,
            quest: result.bundle.components.quest,
          },
          relationships: result.bundle.relationships?.slice(0, 12),
        }
      : undefined,
  };
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
