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

test('an active attacked NPC is read while the DM freely chooses whether it speaks', () => {
  const result = runIsolatedWorldScript(`
    process.env.LLM_MOCK = '0';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_MODEL = 'deepseek-v4-flash';
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(WORLD_AGENT_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    let initialSceneLookupIssued = false;
    let dmNarrationIssued = false;
    let npcResponseIssued = false;
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
        dmNarrationIssued = true;
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
      } else if (!forcedTool && dmNarrationIssued && !npcResponseIssued) {
        npcResponseIssued = true;
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
  assert.deepEqual(result.forcedTools, ['get_entity_bundle', 'dm_speak']);
  assert.equal(result.requestCount, 7);
  assert.deepEqual(result.thinkingTypes, Array(result.requestCount).fill('disabled'));
  assert.match(result.response.answer, /木棍砸在孩子肩头/);
  assert.match(result.response.answer, /你凭什么打人/);
});

test('an NPC review must be observed before a visible reaction can complete the run', () => {
  const result = runIsolatedWorldScript(`
    process.env.LLM_MOCK = '0';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_MODEL = 'test-model';
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(WORLD_AGENT_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    let requestCount = 0;
    const forcedTools = [];
    globalThis.fetch = async (_url, init) => {
      requestCount += 1;
      const body = JSON.parse(init.body);
      const forcedTool = body.tool_choice?.function?.name || '';
      if (forcedTool) forcedTools.push(forcedTool);
      let message;
      if (requestCount === 1) {
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'early-dm-call',
            type: 'function',
            function: {
              name: 'dm_speak',
              arguments: JSON.stringify({
                content: '孩子挨了一棍，仍然站在原地。',
              }),
            },
          }],
        };
      } else if (forcedTool === 'get_entity_bundle') {
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'late-bundle-call',
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
            id: 'reviewed-dm-call',
            type: 'function',
            function: {
              name: 'dm_speak',
              arguments: JSON.stringify({
                content: '他本能地护住伤处，警惕地退到同伴身边，没有贸然还手。',
              }),
            },
          }],
        };
      } else {
        message = { role: 'assistant', content: '', tool_calls: [] };
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
      prompt: '只叙事本轮攻击，并判断受击 NPC 的即时反应。',
      taskKind: 'action-narration',
      model: 'test-model',
      maxSteps: 8,
      judgeQuests: false,
      contextEvents: [{
        type: 'action_result',
        current: true,
        eventId: 104,
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
    console.log(JSON.stringify({ response, forcedTools, requestCount }));
  `);

  assert.deepEqual(
    result.response.steps.map((step) => step.tool),
    ['dm_speak', 'get_entity_bundle', 'dm_speak'],
  );
  assert.deepEqual(result.forcedTools, ['get_entity_bundle', 'dm_speak']);
  assert.equal(result.requestCount, 6);
  assert.match(result.response.answer, /仍然站在原地/);
  assert.match(result.response.answer, /没有贸然还手/);
});

test('a DM-chosen NPC counterattack uses authoritative actions and is narrated afterward', () => {
  const result = runIsolatedWorldScript(`
    Math.random = () => 0.5;
    process.env.LLM_MOCK = '0';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_MODEL = 'test-model';
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(WORLD_AGENT_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    const childStats = worldDb.getComponent('character_wandering_child', 'stats') || {};
    worldDb.upsertComponent('character_wandering_child', 'stats', {
      ...childStats,
      currentHitPoints: 8,
    });
    let requestCount = 0;
    const forcedTools = [];
    globalThis.fetch = async (_url, init) => {
      requestCount += 1;
      const body = JSON.parse(init.body);
      const forcedTool = body.tool_choice?.function?.name || '';
      if (forcedTool) forcedTools.push(forcedTool);
      let message;
      if (requestCount === 1) {
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
      } else if (requestCount === 2) {
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'initial-dm-call',
            type: 'function',
            function: {
              name: 'dm_speak',
              arguments: JSON.stringify({
                content: '木棍砸中孩子的肩膀，他疼得缩了一下，却没有退开。',
              }),
            },
          }],
        };
      } else if (requestCount === 3) {
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'actions-call',
            type: 'function',
            function: {
              name: 'get_world_actions',
              arguments: JSON.stringify({
                actorId: 'character_wandering_child',
                targetId: 'player',
              }),
            },
          }],
        };
      } else if (requestCount === 4) {
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'counterattack-call',
            type: 'function',
            function: {
              name: 'execute_world_action',
              arguments: JSON.stringify({
                actionKind: 'attack.unarmed',
                actorId: 'character_wandering_child',
                targetId: 'player',
              }),
            },
          }],
        };
      } else if (forcedTool === 'dm_speak') {
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'counterattack-dm-call',
            type: 'function',
            function: {
              name: 'dm_speak',
              arguments: JSON.stringify({
                content: '孩子猛地扑上来还了一拳，正打在马大帅身上，造成 2 点伤害。',
              }),
            },
          }],
        };
      } else {
        message = { role: 'assistant', content: '', tool_calls: [] };
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
      prompt: '只叙事本轮攻击，并由 DM 自主判断受击 NPC 的即时反应。',
      taskKind: 'action-narration',
      model: 'test-model',
      maxSteps: 8,
      judgeQuests: false,
      contextEvents: [{
        type: 'action_result',
        current: true,
        eventId: 103,
        summary: '马大帅使用木棍攻击流浪孩子小头领，命中并造成 2 点伤害。',
        result: {
          type: 'attack.resolved',
          facts: {
            actor: { id: 'player', name: '马大帅' },
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
    const playerStats = worldDb.getComponent('player', 'stats');
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ response, forcedTools, requestCount, playerStats }));
  `);

  assert.deepEqual(
    result.response.steps.map((step) => step.tool),
    ['get_entity_bundle', 'dm_speak', 'get_world_actions', 'execute_world_action', 'dm_speak'],
  );
  assert.deepEqual(result.forcedTools, ['dm_speak']);
  assert.equal(result.requestCount, 7);
  assert.equal(result.playerStats.currentHitPoints, 12);
  const counterattack = result.response.steps.find((step) => step.tool === 'execute_world_action');
  assert.equal(counterattack.result.result.action.kind, 'attack.unarmed');
  assert.equal(counterattack.result.result.facts.damage, 2);
  assert.match(result.response.answer, /木棍砸中孩子的肩膀/);
  assert.match(result.response.answer, /还了一拳/);
});

test('speech batched with a mechanical reaction is deferred until the result is observed', () => {
  const result = runIsolatedWorldScript(`
    Math.random = () => 0.5;
    process.env.LLM_MOCK = '0';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_MODEL = 'test-model';
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(WORLD_AGENT_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    let requestCount = 0;
    const forcedTools = [];
    globalThis.fetch = async (_url, init) => {
      requestCount += 1;
      const body = JSON.parse(init.body);
      const forcedTool = body.tool_choice?.function?.name || '';
      if (forcedTool) forcedTools.push(forcedTool);
      let message;
      if (requestCount === 1) {
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
      } else if (requestCount === 2) {
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'initial-dm-call',
            type: 'function',
            function: {
              name: 'dm_speak',
              arguments: JSON.stringify({
                content: '孩子挨了一棍，咬着牙没有退开。',
              }),
            },
          }],
        };
      } else if (requestCount === 3) {
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'actions-call',
            type: 'function',
            function: {
              name: 'get_world_actions',
              arguments: JSON.stringify({
                actorId: 'character_wandering_child',
                targetId: 'player',
              }),
            },
          }],
        };
      } else if (requestCount === 4) {
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'counterattack-call',
            type: 'function',
            function: {
              name: 'execute_world_action',
              arguments: JSON.stringify({
                actionKind: 'attack.unarmed',
                actorId: 'character_wandering_child',
                targetId: 'player',
              }),
            },
          }, {
            id: 'blind-dm-call',
            type: 'function',
            function: {
              name: 'dm_speak',
              arguments: JSON.stringify({
                content: '这句在攻击结果返回前生成，不应展示。',
              }),
            },
          }],
        };
      } else if (forcedTool === 'dm_speak') {
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'observed-dm-call',
            type: 'function',
            function: {
              name: 'dm_speak',
              arguments: JSON.stringify({
                content: '孩子扑上来还了一拳，拳头落在马大帅身上，造成 2 点伤害。',
              }),
            },
          }],
        };
      } else {
        message = { role: 'assistant', content: '', tool_calls: [] };
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
      prompt: '只叙事本轮攻击，并由 DM 自主判断受击 NPC 的即时反应。',
      taskKind: 'action-narration',
      model: 'test-model',
      maxSteps: 8,
      judgeQuests: false,
      contextEvents: [{
        type: 'action_result',
        current: true,
        eventId: 105,
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
    const playerStats = worldDb.getComponent('player', 'stats');
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ response, forcedTools, requestCount, playerStats }));
  `);

  assert.deepEqual(
    result.response.steps.map((step) => step.tool),
    ['get_entity_bundle', 'dm_speak', 'get_world_actions', 'execute_world_action', 'dm_speak', 'dm_speak'],
  );
  assert.equal(result.response.steps[4].result.deferred, true);
  assert.deepEqual(result.forcedTools, ['dm_speak']);
  assert.equal(result.requestCount, 7);
  assert.equal(result.playerStats.currentHitPoints, 12);
  assert.doesNotMatch(result.response.answer, /不应展示/);
  assert.match(result.response.answer, /造成 2 点伤害/);
});

test('a final-step mechanical reaction receives an authoritative fallback narration', () => {
  const result = runIsolatedWorldScript(`
    Math.random = () => 0.5;
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
      const calls = [
        {
          id: 'bundle-call',
          name: 'get_entity_bundle',
          args: { entityId: 'character_wandering_child' },
        },
        {
          id: 'initial-dm-call',
          name: 'dm_speak',
          args: { content: '孩子挨了一棍，猛地抬起头。' },
        },
        {
          id: 'actions-call',
          name: 'get_world_actions',
          args: { actorId: 'character_wandering_child', targetId: 'player' },
        },
        {
          id: 'counterattack-call',
          name: 'execute_world_action',
          args: {
            actionKind: 'attack.unarmed',
            actorId: 'character_wandering_child',
            targetId: 'player',
          },
        },
      ];
      const call = calls[requestCount - 1];
      const message = {
        role: 'assistant',
        content: '',
        tool_calls: [{
          id: call.id,
          type: 'function',
          function: {
            name: call.name,
            arguments: JSON.stringify(call.args),
          },
        }],
      };
      return new Response(JSON.stringify({
        choices: [{ message }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const response = await worldAgent.runWorldAgentTaskStream({
      prompt: '只叙事本轮攻击，并由 DM 自主判断受击 NPC 的即时反应。',
      taskKind: 'action-narration',
      model: 'test-model',
      maxSteps: 4,
      judgeQuests: false,
      contextEvents: [{
        type: 'action_result',
        current: true,
        eventId: 106,
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
    const playerStats = worldDb.getComponent('player', 'stats');
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ response, requestCount, playerStats }));
  `);

  assert.deepEqual(
    result.response.steps.map((step) => step.tool),
    ['get_entity_bundle', 'dm_speak', 'get_world_actions', 'execute_world_action'],
  );
  assert.equal(result.requestCount, 4);
  assert.equal(result.playerStats.currentHitPoints, 12);
  assert.match(result.response.answer, /猛地抬起头/);
  assert.match(result.response.answer, /HP 从 14 降到 12/);
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
