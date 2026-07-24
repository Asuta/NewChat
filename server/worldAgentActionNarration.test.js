import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const WORLD_DB_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'worldDb.js')).href;
const WORLD_AGENT_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'worldAgent.js')).href;

test('local fallback narrates only the current action result', () => {
  const result = runIsolatedWorldScript(`
    process.env.LLM_MOCK = '1';
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(WORLD_AGENT_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    const starts = [];
    const response = await worldAgent.runWorldAgentTaskStream({
      prompt: '只叙事本轮攻击，不要重算命中或伤害。',
      taskKind: 'action-narration',
      judgeQuests: false,
      maxSteps: 3,
      contextEvents: [{
        type: 'action_result',
        current: true,
        eventId: 99,
        summary: '马大帅使用木棍攻击目标，攻击检定 10 未命中。',
        result: {
          narrationHints: {
            visibleEffects: ['目标避开了这次攻击。'],
          },
        },
      }],
    }, {
      onAssistantTextStart: (event) => starts.push(event),
    });
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ response, starts }));
  `);

  assert.equal(result.response.answer, '目标避开了这次攻击。');
  assert.deepEqual(result.response.steps, []);
  assert.deepEqual(result.starts, [{ runId: result.response.runId, messageKind: 'dm-narration' }]);
});

test('dm_speak streams an explicit DM narration message kind', () => {
  const result = runIsolatedWorldScript(`
    process.env.LLM_MOCK = '0';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_MODEL = 'test-model';
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(WORLD_AGENT_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    let requestCount = 0;
    globalThis.fetch = async () => {
      requestCount += 1;
      const message = requestCount === 1
        ? {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'dm-call',
              type: 'function',
              function: {
                name: 'dm_speak',
                arguments: JSON.stringify({ content: '木棍擦着目标挥了过去。' }),
              },
            }],
          }
        : { role: 'assistant', content: '', tool_calls: [] };
      return new Response(JSON.stringify({
        choices: [{ message }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const starts = [];
    const response = await worldAgent.runWorldAgentTaskStream({
      prompt: '只叙事本轮攻击。',
      taskKind: 'action-narration',
      judgeQuests: false,
      model: 'test-model',
      maxSteps: 3,
      contextEvents: [{
        type: 'action_result',
        current: true,
        eventId: 100,
        summary: '攻击未命中。',
        result: {
          narrationHints: {
            visibleEffects: ['目标避开了这次攻击。'],
          },
        },
      }],
    }, {
      onAssistantTextStart: (event) => starts.push(event),
    });
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ response, starts, requestCount }));
  `);

  assert.equal(result.response.answer, '木棍擦着目标挥了过去。');
  assert.deepEqual(result.response.steps.map((step) => step.tool), ['dm_speak']);
  assert.equal(result.requestCount, 2);
  assert.deepEqual(result.starts, [{ runId: result.response.runId, messageKind: 'dm-narration' }]);
});

test('an active attacked NPC is read, narrated, and given an immediate response', () => {
  const result = runIsolatedWorldScript(`
    process.env.LLM_MOCK = '0';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_MODEL = 'deepseek-v4-flash';
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(WORLD_AGENT_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    let initialSceneLookupIssued = false;
    let requestCount = 0;
    const forcedTools = [];
    const thinkingTypes = [];
    globalThis.fetch = async (_url, init) => {
      requestCount += 1;
      const body = JSON.parse(init.body);
      const forcedTool = body.tool_choice?.function?.name || '';
      if (forcedTool) forcedTools.push(forcedTool);
      thinkingTypes.push(body.thinking?.type || '');

      let message;
      if (!forcedTool && !initialSceneLookupIssued) {
        initialSceneLookupIssued = true;
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'scene-call',
            type: 'function',
            function: { name: 'get_current_scene', arguments: '{}' },
          }],
        };
      } else if (forcedTool === 'get_entity_bundle') {
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'bundle-call',
            type: 'function',
            function: {
              name: 'get_entity_bundle',
              arguments: JSON.stringify({ entityId: 'character_wandering_child' }),
            },
          }],
        };
      } else if (forcedTool === 'dm_speak') {
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'dm-call',
            type: 'function',
            function: {
              name: 'dm_speak',
              arguments: JSON.stringify({
                content: '木棍砸在孩子肩头，他疼得踉跄两步，捂住伤处抬头瞪着你。',
              }),
            },
          }],
        };
      } else if (forcedTool === 'npc_speak') {
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'npc-call',
            type: 'function',
            function: {
              name: 'npc_speak',
              arguments: JSON.stringify({
                npcEntityId: 'character_wandering_child',
                portraitState: 'angry',
                content: '你凭什么打人！',
              }),
            },
          }],
        };
      } else {
        message = { role: 'assistant', content: '本轮可以结束。', tool_calls: [] };
      }

      return new Response(JSON.stringify({
        choices: [{ message }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const response = await worldAgent.runWorldAgentTaskStream({
      prompt: '只叙事本轮攻击，并让仍能行动的受击 NPC 回应。',
      taskKind: 'action-narration',
      judgeQuests: false,
      model: 'deepseek-v4-flash',
      thinking: 'enabled',
      maxSteps: 8,
      contextEvents: [{
        type: 'action_result',
        current: true,
        eventId: 101,
        summary: '马大帅使用木棍攻击流浪孩子小头领，命中并造成 2 点伤害。',
        result: {
          type: 'attack.resolved',
          facts: {
            target: { id: 'character_wandering_child', name: '流浪孩子小头领' },
            hpBefore: 10,
            hpAfter: 8,
          },
          narrationHints: {
            visibleEffects: ['流浪孩子小头领受到 2 点伤害。'],
            targetCanAct: true,
          },
        },
      }],
    });
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ response, forcedTools, thinkingTypes, requestCount }));
  `);

  assert.deepEqual(
    result.response.steps.map((step) => step.tool),
    ['get_current_scene', 'get_entity_bundle', 'dm_speak', 'npc_speak'],
  );
  assert.deepEqual(result.forcedTools, ['get_entity_bundle', 'dm_speak', 'npc_speak']);
  assert.equal(result.requestCount, 8);
  assert.deepEqual(result.thinkingTypes, Array(result.requestCount).fill('disabled'));
  assert.match(result.response.answer, /木棍砸在孩子肩头/);
  assert.match(result.response.answer, /你凭什么打人/);
});

test('an attacked player receives DM narration without being forced through npc_speak', () => {
  const result = runIsolatedWorldScript(`
    process.env.LLM_MOCK = '0';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_MODEL = 'test-model';
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(WORLD_AGENT_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    const forcedTools = [];
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      const forcedTool = body.tool_choice?.function?.name || '';
      if (forcedTool) forcedTools.push(forcedTool);
      const message = forcedTool === 'dm_speak'
        ? {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'dm-player-call',
              type: 'function',
              function: {
                name: 'dm_speak',
                arguments: JSON.stringify({ content: 'The blow makes the player stagger.' }),
              },
            }],
          }
        : { role: 'assistant', content: '', tool_calls: [] };
      return new Response(JSON.stringify({
        choices: [{ message }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const response = await worldAgent.runWorldAgentTaskStream({
      prompt: 'Narrate only the current attack.',
      taskKind: 'action-narration',
      judgeQuests: false,
      model: 'test-model',
      maxSteps: 5,
      contextEvents: [{
        type: 'action_result',
        current: true,
        eventId: 102,
        summary: 'The player was hit.',
        result: {
          type: 'attack.resolved',
          facts: {
            target: { id: 'player', name: 'Player' },
            hpBefore: 10,
            hpAfter: 8,
          },
          narrationHints: {
            visibleEffects: ['The player took 2 damage.'],
            targetCanAct: true,
          },
        },
      }],
    });
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ response, forcedTools }));
  `);

  assert.deepEqual(result.response.steps.map((step) => step.tool), ['dm_speak']);
  assert.deepEqual(result.forcedTools, ['dm_speak']);
  assert.equal(result.response.answer, 'The blow makes the player stagger.');
});

function runIsolatedWorldScript(script) {
  const cwd = mkdtempSync(join(tmpdir(), 'newchat-world-agent-action-narration-'));
  try {
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd,
      encoding: 'utf8',
    });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    return JSON.parse(child.stdout.trim().split(/\r?\n/).at(-1) || 'null');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
