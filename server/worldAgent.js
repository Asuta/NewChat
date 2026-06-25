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
import { listWorldSchemas } from './worldSchemas.js';

export const WORLD_AGENT_MAX_STEPS = 12;

export async function runWorldAgentTask(input) {
  const prompt = String(input.prompt || '').trim();
  if (!prompt) throw new Error('prompt 不能为空。');

  const runId = createAgentRun(prompt);
  const steps = [];
  addConversation('user', 'player', '玩家', prompt);
  addEvent('agent.started', 'player', null, { summary: `Agent 开始处理：${prompt}` });

  try {
    for (let stepIndex = 1; stepIndex <= WORLD_AGENT_MAX_STEPS; stepIndex += 1) {
      const call = await planNextToolCall({
        prompt,
        steps,
        model: input.model,
        thinking: input.thinking,
        fixedContext: input.fixedContext,
        conversationContext: input.conversationContext,
      });
      const args = isRecord(call.args) ? call.args : {};
      const result = executeWorldTool(call.tool, args, prompt);
      steps.push({ index: stepIndex, tool: call.tool, args, result });
      addAgentStep(runId, stepIndex, call.tool, args, result);
      addEvent('agent.tool', null, null, {
        summary: formatToolSummary(call.tool, result),
        tool: call.tool,
        args,
        result,
      });

      if (isRepeatedToolFailure(steps)) {
        const answer = `工具连续失败，已停止本轮操作：${result.error || '未知错误'}。`;
        addConversation('assistant', null, '世界 Agent', answer);
        finishAgentRun(runId, 'completed', answer, null);
        addEvent('agent.finished', null, null, { summary: answer, stepCount: steps.length });
        return {
          answer,
          runId,
          steps,
          world: getWorldOverview(),
        };
      }

      if (call.tool === 'finish' || result.done === true) {
        const answer = String(result.answer || summarizeAgentResult(prompt, steps));
        addConversation('assistant', null, '世界 Agent', answer);
        finishAgentRun(runId, 'completed', answer, null);
        addEvent('agent.finished', null, null, { summary: answer, stepCount: steps.length });
        return {
          answer,
          runId,
          steps,
          world: getWorldOverview(),
        };
      }
    }

    const answer = summarizeAgentResult(prompt, steps);
    addConversation('assistant', null, '世界 Agent', answer);
    finishAgentRun(runId, 'completed', answer, null);
    return {
      answer,
      runId,
      steps,
      world: getWorldOverview(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishAgentRun(runId, 'failed', null, message);
    addEvent('agent.failed', null, null, { summary: message, prompt, stepCount: steps.length });
    throw error;
  }
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

async function planNextToolCall({ prompt, steps, model, thinking, fixedContext, conversationContext }) {
  if (process.env.LLM_MOCK === '1') {
    return fallbackToolCall(prompt, steps);
  }

  const apiKey = process.env.LLM_API_KEY;
  const selectedModel = normalizeModel(model) || process.env.LLM_MODEL;
  if (!apiKey || !selectedModel) {
    return fallbackToolCall(prompt, steps);
  }

  const messages = [
    {
      role: 'system',
      content: [
        fixedContext?.trim() ? `固定上下文：\n${fixedContext.trim()}` : '',
        '你是 NewChat 本地游戏世界 Agent。世界数据由 SQLite 中的 entities、components、relationships 组成。',
        '你必须通过工具读取或写入世界，不能编造数据库事实。每次只输出一个 JSON 工具调用，不要输出 Markdown。',
        '可用工具：search_entities、get_entity_bundle、get_current_scene、get_scene_entities、get_relationships、enter_scene、apply_world_patch、finish。',
        'conversationContext 里可能包含上一轮 Agent 工具调用记录；这些记录是已经读取过的数据库事实，可以作为本轮回答依据。',
        '如果玩家重复询问同一人物、道具、场景或设定，并且 conversationContext 已有对应的 get_entity_bundle、get_current_scene、get_scene_entities 或 get_relationships 结果，优先直接 finish 回答，不要重复调用读取工具。',
        '只有当上下文中没有相关工具结果、结果不完整、目标不明确、或玩家明确要求最新/重新查看/当前状态时，才调用读取工具。',
        '玩家要求切换/进入场景时，如果目标场景已明确且已在上下文中出现，可以直接 enter_scene；否则先 search_entities 找 scene，再 enter_scene。',
        '玩家询问当前地点、这里有什么、有哪些人时，如果上下文已有当前场景读取结果，可以直接回答；否则使用 get_current_scene。',
        '玩家询问人物/道具/设定时，如果上下文已有对应实体详情，可以直接回答；否则先 search_entities，再 get_entity_bundle；必要时继续 get_relationships 或读取相关实体。',
        '玩家要求创建或修改长期世界事实时，使用 apply_world_patch。创建长期道具必须创建 item entity，并用 ownership relationship 绑定持有者。',
        'apply_world_patch 必须使用 args.operations 数组，不要使用 patches、JSON Patch path 或 /entities/... 路径。',
        '修改实体组件字段时使用：{"tool":"apply_world_patch","args":{"operations":[{"op":"set_component","entityId":"character_lina","componentType":"identity","path":"gender","value":"male"}],"dryRun":false}}。',
        '创建实体时使用 create_entity；创建道具并设置持有者时使用 create_owned_item；设置关系时使用 set_relationship。',
        '删除实体、删除组件、大批量修改、修改玩家关键状态时，先 dryRun=true 并让玩家确认。',
        '输出格式示例：{"tool":"search_entities","args":{"query":"莉娜","kind":"character"}} 或 {"tool":"finish","args":{"answer":"中文回答"}}。',
      ].filter(Boolean).join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          task: prompt,
          conversationContext: Array.isArray(conversationContext) ? conversationContext.slice(-10) : [],
          world: shrinkWorld(getWorldOverview()),
          schemas: listWorldSchemas(),
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
  });

  if (!response.ok) {
    return fallbackToolCall(prompt, steps);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  return normalizeToolCall(JSON.parse(stripCodeFence(String(content || '{}'))));
}

function fallbackToolCall(prompt, steps) {
  if (steps.length === 0) {
    if (/当前|这里|场景|地点|在哪|哪里|有什么|出口/.test(prompt)) {
      return { tool: 'get_current_scene', args: {} };
    }
    return { tool: 'search_entities', args: { query: prompt, limit: 8 } };
  }

  const last = steps.at(-1);
  if (last?.tool === 'search_entities' && last.result?.entities?.[0]) {
    return { tool: 'get_entity_bundle', args: { entityId: last.result.entities[0].id } };
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
    'enter_scene',
    'apply_world_patch',
    'finish',
  ]);
  return {
    tool: valid.has(tool) ? tool : 'finish',
    args: isRecord(raw.args) ? raw.args : raw,
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
  const thinking = requestThinking === 'enabled' || requestThinking === 'disabled' ? requestThinking : process.env.LLM_THINKING;
  if (thinking !== 'enabled' && thinking !== 'disabled') return {};
  return { thinking: { type: thinking } };
}

function normalizeModel(value) {
  return value === 'deepseek-v4-flash' || value === 'deepseek-v4-pro' ? value : null;
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
