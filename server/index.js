import express from 'express';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyWorldPatch,
  checkpointWorldDb,
  enterScene,
  getCurrentScene,
  getEntityBundle,
  getWorldMap,
  getWorldOverview,
  ensurePlayableCharacterStats,
  listRelationships,
  migrateWorldDb,
  rebuildSearchIndex,
  restoreWorldDbFromFile,
  searchEntities,
  seedWorldIfEmpty,
} from './worldDb.js';
import { executeWorldTool, getAgentHistory, runWorldAgentTask, runWorldAgentTaskStream } from './worldAgent.js';
import { executeWorldAction, listWorldActions } from './worldActions.js';
import { listWorldSchemas } from './worldSchemas.js';
import { readFixedContextBundle, writeUserFixedContext } from './contextLoader.js';
import {
  ensurePresentationDb,
  getCurrentPresentationStage,
  getPresentationCatalog,
  PRESENTATION_ASSETS_DIR,
} from './presentationDb.js';
import {
  createSaveExportBundle,
  ensureTemplateDbFromSaveIfMissing,
  ensureTemplatePlayableDefaults,
  importSaveBundle,
  resetSaveToTemplate,
  TEMPLATE_DB_FILE,
} from './saveManager.js';

const loadedConfigFiles = loadRuntimeConfig();
migrateWorldDb();
seedWorldIfEmpty();
ensurePlayableCharacterStats();
rebuildSearchIndex();
checkpointWorldDb();
ensureTemplateDbFromSaveIfMissing();
ensureTemplatePlayableDefaults();
ensurePresentationDb();

const app = express();
const HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const PORT = parsePort(process.env.PORT, DEFAULT_PORT);
const MAX_PORT_ATTEMPTS = 20;
const DEV_PORT_FILE = resolve(process.cwd(), '.newchat', 'server-port');
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const AVAILABLE_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'];
const FIXED_CONTEXT_PREFIX = '以下是固定上下文。';
const COMPACT_SYSTEM_PROMPT =
  '你是一个对话上下文压缩助手。请用中文总结给定聊天记录，保留用户目标、关键事实、已达成结论、未解决问题、重要偏好和后续需要延续的上下文。不要添加原对话没有的信息。输出一段清晰、紧凑、可直接作为后续大模型上下文的摘要。';

app.use(express.json({ limit: '64mb' }));
app.use('/api/presentation/assets', express.static(PRESENTATION_ASSETS_DIR));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    providerConfigured: Boolean(process.env.LLM_API_KEY && process.env.LLM_MODEL),
    mock: process.env.LLM_MOCK === '1',
    model: process.env.LLM_MODEL || null,
    baseURL: normalizeBaseURL(process.env.LLM_BASE_URL || DEFAULT_BASE_URL),
    thinking: process.env.LLM_THINKING || null,
    availableModels: AVAILABLE_MODELS,
    configFiles: loadedConfigFiles,
  });
});

app.get('/api/fixed-context', (_req, res) => {
  res.json(readFixedContextBundle());
});

app.put('/api/fixed-context', (req, res) => {
  const content = typeof req.body?.content === 'string' ? req.body.content : '';
  writeUserFixedContext(content);
  res.json(readFixedContextBundle());
});

app.post('/api/save/reset', (_req, res) => {
  try {
    ensureTemplatePlayableDefaults();
    checkpointWorldDb();
    restoreWorldDbFromFile(TEMPLATE_DB_FILE);
    resetSaveToTemplate();
    refreshWorldRuntime();
    res.json({
      world: getWorldOverview(),
      fixedContext: readFixedContextBundle(),
      conversations: null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || '重置存档失败。' });
  }
});

app.get('/api/save/export', (req, res) => {
  try {
    const mode = req.query.mode === 'full' ? 'full' : 'template';
    checkpointWorldDb();
    const bundle = createSaveExportBundle(mode);
    const suffix = mode === 'full' ? 'full' : 'template';
    res.setHeader('Content-Disposition', `attachment; filename="newchat-${suffix}.newchat-save.json"`);
    res.json(bundle);
  } catch (error) {
    res.status(500).json({ error: error.message || '导出世界包失败。' });
  }
});

app.post('/api/save/import', (req, res) => {
  try {
    checkpointWorldDb();
    const result = importSaveBundle(req.body);
    ensureTemplatePlayableDefaults();
    restoreWorldDbFromFile(result.saveDbFile);
    refreshWorldRuntime();
    res.json({
      world: getWorldOverview(),
      fixedContext: readFixedContextBundle(),
      conversations: result.conversations,
    });
  } catch (error) {
    res.status(400).json({ error: error.message || '导入世界包失败。' });
  }
});

app.get('/api/world', (_req, res) => {
  res.json(getWorldOverview());
});

app.get('/api/world/schemas', (_req, res) => {
  res.json(listWorldSchemas());
});

app.get('/api/world/current-scene', (_req, res) => {
  res.json(getCurrentScene());
});

app.get('/api/world/map', (_req, res) => {
  res.json(getWorldMap());
});

app.get('/api/presentation/catalog', (_req, res) => {
  res.json(getPresentationCatalog());
});

app.get('/api/presentation/current-stage', (_req, res) => {
  res.json(getCurrentPresentationStage(getCurrentScene()));
});

app.get('/api/world/entities', (req, res) => {
  res.json({
    entities: searchEntities({
      query: String(req.query.query || ''),
      kind: String(req.query.kind || ''),
      sceneId: String(req.query.sceneId || ''),
      limit: Number(req.query.limit || 24),
    }),
  });
});

app.get('/api/world/entities/:entityId', (req, res) => {
  const bundle = getEntityBundle(req.params.entityId);
  if (!bundle) {
    res.status(404).json({ error: `实体 ${req.params.entityId} 不存在。` });
    return;
  }
  res.json(bundle);
});

app.get('/api/world/relationships', (req, res) => {
  res.json({
    relationships: listRelationships({
      entityId: String(req.query.entityId || ''),
      direction: String(req.query.direction || 'both'),
      type: req.query.type ? String(req.query.type) : undefined,
    }),
  });
});

app.get('/api/world/actions', (req, res) => {
  try {
    res.json(
      listWorldActions({
        actorId: String(req.query.actorId || 'player'),
        targetId: String(req.query.targetId || ''),
      }),
    );
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : '可用动作读取失败。' });
  }
});

app.post('/api/world/actions/execute', (req, res) => {
  try {
    res.json(executeWorldAction(req.body || {}));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : '动作执行失败。' });
  }
});

app.post('/api/world/scene/enter', (req, res) => {
  try {
    res.json(enterScene(String(req.body?.sceneId || '')));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : '场景切换失败。' });
  }
});

app.post('/api/world/patch', (req, res) => {
  try {
    res.json(
      applyWorldPatch({
        operations: Array.isArray(req.body?.operations) ? req.body.operations : [],
        confirmedTargetIds: Array.isArray(req.body?.confirmedTargetIds) ? req.body.confirmedTargetIds : [],
        dryRun: req.body?.dryRun === true,
        prompt: typeof req.body?.prompt === 'string' ? req.body.prompt : '',
      }),
    );
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : '世界数据写入失败。' });
  }
});

app.post('/api/world/tools/:tool', (req, res) => {
  const result = executeWorldTool(req.params.tool, req.body || {}, typeof req.body?.prompt === 'string' ? req.body.prompt : '');
  res.status(result.ok === false ? 400 : 200).json(result);
});

app.post('/api/world/agent', async (req, res) => {
  try {
    const result = await runWorldAgentTask({
      prompt: req.body?.prompt,
      taskRole: req.body?.taskRole,
      model: req.body?.model,
      thinking: req.body?.thinking,
      maxSteps: req.body?.maxSteps,
      contextEvents: sanitizeContextEvents(req.body?.contextEvents),
      conversationContext: sanitizeMessages(req.body?.messages),
    });
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : '世界 Agent 执行失败。' });
  }
});

app.post('/api/world/agent/stream', async (req, res) => {
  const controller = new AbortController();
  req.on('aborted', () => controller.abort());
  res.on('close', () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });

  setEventStreamHeaders(res);
  let didSendDone = false;

  try {
    const result = await runWorldAgentTaskStream(
      {
        prompt: req.body?.prompt,
        taskRole: req.body?.taskRole,
        model: req.body?.model,
        thinking: req.body?.thinking,
        maxSteps: req.body?.maxSteps,
        contextEvents: sanitizeContextEvents(req.body?.contextEvents),
        conversationContext: sanitizeMessages(req.body?.messages),
        signal: controller.signal,
      },
      {
        onStart: (event) => writeSseEvent(res, 'start', event),
        onStep: (event) => writeSseEvent(res, 'step', { step: event.step }),
        onSpeechStart: (event) => writeSseEvent(res, 'speech_start', event),
        onSpeechDelta: (delta) => writeSseEvent(res, 'speech_delta', { delta }),
        onNpcSpeechStart: (event) => writeSseEvent(res, 'npc_speech_start', event),
        onNpcSpeechDelta: (event) => writeSseEvent(res, 'npc_speech_delta', event),
        onNpcSpeech: (event) => writeSseEvent(res, 'npc_speech', event),
        onFinalAnswerDelta: (delta) => writeSseEvent(res, 'answer_delta', { delta }),
        onDone: (event) => {
          didSendDone = true;
          writeSseEvent(res, 'done', event);
        },
      },
    );

    if (!didSendDone) {
      writeSseEvent(res, 'done', result);
    }
    res.end();
  } catch (error) {
    if (controller.signal.aborted) {
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

    writeSseEvent(res, 'error', { error: error instanceof Error ? error.message : '世界 Agent 执行失败。' });
    res.end();
  }
});

app.get('/api/world/agent/runs', (_req, res) => {
  res.json({ runs: getAgentHistory() });
});

app.post('/api/chat/stream', async (req, res) => {
  const messages = sanitizeMessages(req.body?.messages);
  if (!messages.length) {
    res.status(400).json({ error: 'messages 不能为空' });
    return;
  }

  if (process.env.LLM_MOCK === '1') {
    setStreamHeaders(res);
    await writeMockStream(res, messages);
    return;
  }

  const apiKey = process.env.LLM_API_KEY;
  const model = normalizeModel(req.body?.model) || process.env.LLM_MODEL;
  if (!apiKey || !model) {
    res.status(500).json({ error: '服务端缺少 LLM_API_KEY 或 LLM_MODEL。可以设置 LLM_MOCK=1 验证本地界面。' });
    return;
  }

  const controller = new AbortController();
  req.on('aborted', () => controller.abort());
  res.on('close', () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });

  try {
    const upstream = await fetch(`${normalizeBaseURL(process.env.LLM_BASE_URL || DEFAULT_BASE_URL)}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: withSystemPrompt(messages),
        stream: true,
        ...deepSeekThinkingConfig(req.body?.thinking),
      }),
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      res.status(upstream.status).json({ error: detail || `模型服务请求失败：${upstream.status}` });
      return;
    }

    setStreamHeaders(res);
    await pipeOpenAIStream(upstream.body, res);
  } catch (error) {
    if (controller.signal.aborted) {
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }
    if (!res.headersSent) {
      res.status(502).json({ error: `模型服务连接失败：${error instanceof Error ? error.message : '未知错误'}` });
      return;
    }
    res.write(`模型服务连接失败：${error instanceof Error ? error.message : '未知错误'}`);
    res.end();
  }
});

app.post('/api/chat/compact', async (req, res) => {
  const messages = sanitizeMessages(req.body?.messages);
  if (!messages.length) {
    res.status(400).json({ error: 'messages 不能为空' });
    return;
  }

  if (process.env.LLM_MOCK === '1') {
    res.json({ summary: createMockSummary(messages) });
    return;
  }

  const apiKey = process.env.LLM_API_KEY;
  const model = normalizeModel(req.body?.model) || process.env.LLM_MODEL;
  if (!apiKey || !model) {
    res.status(500).json({ error: '服务端缺少 LLM_API_KEY 或 LLM_MODEL。可以设置 LLM_MOCK=1 验证本地界面。' });
    return;
  }

  const controller = new AbortController();
  req.on('aborted', () => controller.abort());

  try {
    const upstream = await fetch(`${normalizeBaseURL(process.env.LLM_BASE_URL || DEFAULT_BASE_URL)}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: COMPACT_SYSTEM_PROMPT },
          { role: 'user', content: formatMessagesForCompaction(messages) },
        ],
        stream: false,
        ...deepSeekThinkingConfig(req.body?.thinking),
      }),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      res.status(upstream.status).json({ error: detail || `模型服务请求失败：${upstream.status}` });
      return;
    }

    const json = await upstream.json();
    const summary = json.choices?.[0]?.message?.content?.trim();
    if (!summary) {
      res.status(502).json({ error: '模型服务没有返回摘要内容。' });
      return;
    }

    res.json({ summary });
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }
    res.status(502).json({ error: `上下文压缩失败：${error instanceof Error ? error.message : '未知错误'}` });
  }
});

listenWithPortFallback(PORT);

function listenWithPortFallback(startPort) {
  const tryListen = (port, attemptsLeft) => {
    const server = app.listen(port, HOST);

    server.once('listening', () => {
      writeDevPortFile(port);
      const note = port === startPort ? '' : ` (requested ${startPort} was busy)`;
      console.log(`NewChat server listening on http://${HOST}:${port}${note}`);
    });

    server.once('error', (error) => {
      if (error?.code === 'EADDRINUSE' && attemptsLeft > 1) {
        const nextPort = port + 1;
        console.warn(`Port ${port} is in use, trying ${nextPort}...`);
        tryListen(nextPort, attemptsLeft - 1);
        return;
      }

      console.error(error);
      process.exit(1);
    });
  };

  tryListen(startPort, MAX_PORT_ATTEMPTS);
}

function writeDevPortFile(port) {
  mkdirSync(resolve(process.cwd(), '.newchat'), { recursive: true });
  writeFileSync(DEV_PORT_FILE, String(port), 'utf8');
}

function loadRuntimeConfig() {
  const originalKeys = new Set(Object.keys(process.env));
  const candidates = [
    process.env.NEWCHAT_CONFIG_FILE,
    process.env.NEWCHAT_CONFIG_DIR ? resolve(process.env.NEWCHAT_CONFIG_DIR, 'config.env') : null,
    getGitSharedConfigPath(),
    resolve(process.cwd(), '.env'),
  ].filter(Boolean);
  const loaded = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const envPath = resolve(candidate);
    if (seen.has(envPath) || !existsSync(envPath)) continue;
    seen.add(envPath);
    loadDotenvFile(envPath, originalKeys);
    loaded.push(envPath);
  }

  return loaded;
}

function refreshWorldRuntime() {
  migrateWorldDb();
  seedWorldIfEmpty();
  ensurePlayableCharacterStats();
  rebuildSearchIndex();
  checkpointWorldDb();
}

function parsePort(value, fallback) {
  const port = Number(value || fallback);
  if (Number.isInteger(port) && port > 0 && port < 65536) {
    return port;
  }
  return fallback;
}

function getGitSharedConfigPath() {
  try {
    const output = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!output) return null;
    return resolve(process.cwd(), output, 'newchat', 'config.env');
  } catch {
    return null;
  }
}

function loadDotenvFile(envPath, originalKeys) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !originalKeys.has(key)) {
      process.env[key] = value;
    }
  }
}

function normalizeBaseURL(value) {
  return value.replace(/\/+$/, '');
}

function setStreamHeaders(res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

function setEventStreamHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

function writeSseEvent(res, event, data) {
  if (res.destroyed || res.writableEnded) return;
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sanitizeMessages(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((message) => ['system', 'user', 'assistant'].includes(message?.role) && typeof message?.content === 'string')
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 16000),
    }));
}

function sanitizeContextEvents(input) {
  if (!Array.isArray(input)) return [];
  return input.map(sanitizeContextEvent).filter(Boolean);
}

function sanitizeContextEvent(event) {
  if (!isRecord(event)) return null;
  const type = String(event.type || '');

  if (type === 'summary') {
    return {
      type: 'summary',
      content: String(event.content || '').slice(0, 16000),
    };
  }

  if (type === 'message') {
    if (!['system', 'user', 'assistant'].includes(event.role)) return null;
    return {
      type: 'message',
      role: event.role,
      content: String(event.content || '').slice(0, 16000),
    };
  }

  if (type === 'scene_transition') {
    return {
      type: 'scene_transition',
      content: String(event.content || '').slice(0, 16000),
      fromSceneId: sanitizeOptionalString(event.fromSceneId, 400),
      fromSceneName: sanitizeOptionalString(event.fromSceneName, 400),
      toSceneId: sanitizeOptionalString(event.toSceneId, 400),
      toSceneName: sanitizeOptionalString(event.toSceneName, 400),
    };
  }

  if (type === 'action_result') {
    return {
      type: 'action_result',
      summary: String(event.summary || '').slice(0, 4000),
      result: isRecord(event.result) ? event.result : {},
    };
  }

  if (type === 'agent_step') {
    const tool = String(event.tool || '').trim();
    if (!tool) return null;
    return {
      type: 'agent_step',
      ...(Number.isFinite(event.runId) ? { runId: event.runId } : {}),
      ...(Number.isFinite(event.stepIndex) ? { stepIndex: event.stepIndex } : {}),
      tool,
      args: isRecord(event.args) ? event.args : {},
      result: isRecord(event.result) ? event.result : {},
    };
  }

  if (type === 'model_message') {
    const message = sanitizeModelTranscriptMessage(event.message);
    return message ? { type: 'model_message', message } : null;
  }

  return null;
}

function sanitizeModelTranscriptMessage(input) {
  if (!isRecord(input)) return null;

  if (input.role === 'tool') {
    const toolCallId = String(input.tool_call_id || '').trim();
    if (!toolCallId) return null;
    return {
      role: 'tool',
      tool_call_id: toolCallId.slice(0, 400),
      content: String(input.content || '').slice(0, 16000),
    };
  }

  if (input.role !== 'assistant') return null;
  return {
    role: 'assistant',
    content: String(input.content || '').slice(0, 16000),
    ...(typeof input.reasoning_content === 'string'
      ? { reasoning_content: input.reasoning_content.slice(0, 64000) }
      : {}),
    ...(Array.isArray(input.tool_calls)
      ? { tool_calls: input.tool_calls.map(sanitizeModelToolCall).filter(Boolean) }
      : {}),
  };
}

function sanitizeModelToolCall(input, index) {
  if (!isRecord(input)) return null;
  const fn = isRecord(input.function) ? input.function : {};
  const name = String(fn.name || '').trim();
  if (!name) return null;
  return {
    id: String(input.id || `tool_call_${index + 1}`).slice(0, 400),
    type: String(input.type || 'function').slice(0, 80),
    function: {
      name: name.slice(0, 200),
      arguments: String(fn.arguments || '').slice(0, 64000),
    },
  };
}

function sanitizeOptionalString(value, limit) {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  return value.slice(0, limit);
}

function withSystemPrompt(messages) {
  const prompt = process.env.SYSTEM_PROMPT?.trim();
  if (!prompt) return messages;
  if (isFixedContextMessage(messages[0])) {
    return [messages[0], { role: 'system', content: prompt }, ...messages.slice(1)];
  }
  return [{ role: 'system', content: prompt }, ...messages];
}

function isFixedContextMessage(message) {
  return message?.role === 'system' && message.content.startsWith(FIXED_CONTEXT_PREFIX);
}

function deepSeekThinkingConfig(requestThinking) {
  const thinking = normalizeThinkingMode(requestThinking) || normalizeThinkingMode(process.env.LLM_THINKING);
  if (!thinking) return {};
  return {
    thinking: {
      type: thinking,
    },
  };
}

function normalizeThinkingMode(value) {
  if (value !== 'enabled' && value !== 'disabled') return null;
  return value;
}

function normalizeModel(value) {
  if (!AVAILABLE_MODELS.includes(value)) return null;
  return value;
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

async function pipeOpenAIStream(body, res) {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = '';

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
      if (!payload) {
        continue;
      }
      if (payload === '[DONE]') {
        res.end();
        return;
      }

      try {
        const json = JSON.parse(payload);
        const content = json.choices?.[0]?.delta?.content;
        if (content) res.write(content);
      } catch {
        // Ignore malformed keep-alive lines from compatible providers.
      }
    }
  }

  res.end();
}

async function writeMockStream(res, messages) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content || '这个问题';
  const chunks = [
    `我收到了你的问题：“${lastUserMessage.slice(0, 60)}”。\n\n`,
    '这是本地模拟回复，用来验证 NewChat 的流式输出体验：\n',
    '1. 前端会在收到每个片段时更新助手消息。\n',
    '2. 你可以点击停止按钮中断当前请求。\n',
    '3. 配置 LLM_API_KEY、LLM_MODEL 和可选 LLM_BASE_URL 后，就会切换到真实模型。\n\n',
    '4. 较长回复会持续分段进入消息流，便于观察输入区和停止按钮状态。\n',
    '5. 会话会保存在浏览器本地，下次打开仍能继续查看。\n\n',
    '现在聊天闭环已经可以正常工作。',
  ];

  for (const chunk of chunks) {
    if (res.destroyed || res.writableEnded) return;
    res.write(chunk);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 450));
  }
  res.end();
}

function formatMessagesForCompaction(messages) {
  return messages
    .map((message, index) => {
      const speaker = message.role === 'user' ? '用户' : message.role === 'assistant' ? '助手' : '系统';
      return `${index + 1}. ${speaker}：${message.content}`;
    })
    .join('\n\n');
}

function createMockSummary(messages) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content || '';
  return [
    `这是本地模拟的上下文摘要，共压缩 ${messages.length} 条消息。`,
    lastUserMessage ? `最近用户关注的问题是：“${lastUserMessage.slice(0, 80)}”。` : '',
    '后续回复应延续当前会话目标、保持中文、简洁可靠，并参考压缩前已经出现的重要信息。',
  ]
    .filter(Boolean)
    .join('\n');
}
