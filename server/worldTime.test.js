import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const WORLD_DB_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'worldDb.js')).href;

test('transitionScene advances time atomically and starts a new scene visit', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();

    const before = worldDb.getWorldTimeState();
    const beforeAgain = worldDb.getWorldTimeState();
    const context = worldDb.getWorldTimeContext();
    const transition = worldDb.transitionScene('scene_city_street', {
      sceneTimeSegments: [],
      travelMinutes: 30,
      throughConversationId: context.latestConversationId,
      travelReason: '交谈并调查礼拜堂。',
      previousSceneSummary: '玩家完成调查后离开城市客运站。',
    });
    const after = worldDb.getWorldTimeState();
    const events = worldDb.listEvents(10).filter((event) => event.type === 'scene.transition');
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ before, beforeAgain, transition, after, events }));
  `);

  assert.equal(result.before.clock.fullLabel, '第 1 日 12:00');
  assert.equal(result.beforeAgain.currentSceneVisit.id, result.before.currentSceneVisit.id);
  assert.equal(result.transition.clockAfter.fullLabel, '第 1 日 12:30');
  assert.equal(result.after.clock.absoluteMinutes, 750);
  assert.equal(result.after.currentSceneVisit.sceneId, 'scene_city_street');
  assert.equal(result.after.currentSceneVisit.enteredAt, 750);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].payload.elapsedMinutes, 30);
});

test('a rejected scene transition leaves time and location unchanged', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    const before = worldDb.getWorldOverview();
    let error = '';
    try {
      const context = worldDb.getWorldTimeContext();
      worldDb.transitionScene('scene_victoria', {
        sceneTimeSegments: [],
        travelMinutes: 90,
        throughConversationId: context.latestConversationId,
        travelReason: '赶路。',
        previousSceneSummary: '离开礼拜堂。',
      });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const after = worldDb.getWorldOverview();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ before, after, error }));
  `);

  assert.match(result.error, /不能直接前往/);
  assert.equal(result.after.time.clock.absoluteMinutes, result.before.time.clock.absoluteMinutes);
  assert.equal(result.after.currentScene.scene.id, result.before.currentScene.scene.id);
});

test('world clock rolls over to the next day', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.setMeta('worldClock.absoluteMinutes', '1430');
    const context = worldDb.getWorldTimeContext();
    const transition = worldDb.transitionScene('scene_city_street', {
      sceneTimeSegments: [],
      travelMinutes: 20,
      throughConversationId: context.latestConversationId,
      travelReason: '黄昏时离开礼拜堂。',
      previousSceneSummary: '玩家整理装备后出发。',
    });
    worldDb.closeWorldDb();
    console.log(JSON.stringify(transition.clockAfter));
  `);

  assert.equal(result.day, 2);
  assert.equal(result.label, '00:10');
  assert.equal(result.fullLabel, '第 2 日 00:10');
});

test('transitionScene rejects missing DM time evidence without changing state', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    const before = worldDb.getWorldOverview();
    let error = '';
    try {
      worldDb.transitionScene('scene_city_street', {});
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const after = worldDb.getWorldOverview();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ before, after, error }));
  `);

  assert.match(result.error, /sceneTimeSegments/);
  assert.equal(result.after.time.clock.absoluteMinutes, result.before.time.clock.absoluteMinutes);
  assert.equal(result.after.currentScene.scene.id, result.before.currentScene.scene.id);
});

test('transitionScene rejects duplicate entry into the current scene', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    const before = worldDb.getWorldOverview();
    let error = '';
    try {
      const context = worldDb.getWorldTimeContext();
      worldDb.transitionScene('scene_bus_station', {
        sceneTimeSegments: [],
        travelMinutes: 10,
        throughConversationId: context.latestConversationId,
        travelReason: '重复请求。',
        previousSceneSummary: '仍在原地。',
      });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const after = worldDb.getWorldOverview();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ before, after, error }));
  `);

  assert.match(result.error, /已经位于/);
  assert.equal(result.after.time.clock.absoluteMinutes, result.before.time.clock.absoluteMinutes);
  assert.equal(result.after.time.currentSceneVisit.id, result.before.time.currentSceneVisit.id);
});

test('world agent cannot move the player through apply_world_patch', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(pathToFileURL(join(process.cwd(), 'server', 'worldAgent.js')).href)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    const before = worldDb.getWorldOverview();
    const toolResult = worldAgent.executeWorldTool('apply_world_patch', {
      operations: [{
        op: 'set_location',
        entityId: 'player',
        sceneId: 'scene_city_street',
        summary: '绕过场景切换。',
      }],
    }, '测试玩家移动保护');
    const aliasResult = worldAgent.executeWorldTool('apply_world_patch', {
      operations: [{
        op: 'move_entity',
        entityId: 'player',
        sceneId: 'scene_city_street',
        summary: '通过移动别名绕过场景切换。',
      }],
    }, '测试玩家移动别名保护');
    const after = worldDb.getWorldOverview();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ before, after, toolResult, aliasResult }));
  `);

  assert.equal(result.toolResult.ok, false);
  assert.match(result.toolResult.error, /transition_scene/);
  assert.equal(result.aliasResult.ok, false);
  assert.match(result.aliasResult.error, /transition_scene/);
  assert.equal(result.after.currentScene.scene.id, result.before.currentScene.scene.id);
  assert.equal(result.after.time.clock.absoluteMinutes, result.before.time.clock.absoluteMinutes);
});

test('world agent transition tool advances the clock exposed by get_time_state', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(pathToFileURL(join(process.cwd(), 'server', 'worldAgent.js')).href)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    const before = worldAgent.executeWorldTool('get_time_state', {});
    const transition = worldAgent.executeWorldTool('transition_scene', {
      sceneId: 'scene_city_street',
      sceneTimeSegments: [],
      travelMinutes: 30,
      travelReason: '从客运站出口前往城里街面。',
      throughConversationId: before.timeContext.latestConversationId,
      previousSceneSummary: '玩家查明礼拜堂现状后出发。',
    });
    const time = worldAgent.executeWorldTool('get_time_state', {});
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ transition, time }));
  `);

  assert.equal(result.transition.ok, true);
  assert.equal(result.transition.clockAfter.fullLabel, '第 1 日 12:30');
  assert.equal(result.time.ok, true);
  assert.equal(result.time.time.clock.fullLabel, '第 1 日 12:30');
  assert.equal(result.time.time.currentSceneVisit.sceneId, 'scene_city_street');
});

test('world agent keeps the complete current scene in transition tool results', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(pathToFileURL(join(process.cwd(), 'server', 'worldAgent.js')).href)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    const before = worldAgent.executeWorldTool('get_time_state', {});
    const transition = worldAgent.executeWorldTool('transition_scene', {
      sceneId: 'scene_city_street',
      sceneTimeSegments: [],
      travelMinutes: 30,
      travelReason: '从客运站出口前往城里街面。',
      throughConversationId: before.timeContext.latestConversationId,
      previousSceneSummary: '玩家查明客运站现状后出发。',
    });
    const prepared = worldAgent.prepareToolResultForAgentStep('transition_scene', transition);
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ transition, prepared }));
  `);

  assert.deepEqual(result.prepared, result.transition);
  assert.equal(result.prepared.scene.scene.id, 'scene_city_street');
  assert.equal(typeof result.prepared.scene.sceneComponent.description, 'string');
  assert.ok(result.prepared.scene.sceneComponent.description.length > 0);
  assert.ok(result.prepared.scene.residents.some((resident) => resident.id === 'character_gangzi'));
  assert.ok(result.prepared.scene.residents.some((resident) => resident.id === 'character_erhu_busker'));
  assert.ok(Array.isArray(result.prepared.scene.items));
  assert.ok(Array.isArray(result.prepared.scene.events));
  assert.ok(result.prepared.scene.exits.length > 0);
  assert.ok(Array.isArray(result.prepared.scene.relatedLore));
  assert.match(result.prepared.summary, /随玩家移动/);
});

test('world agent rejects hidden enter_scene calls', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(pathToFileURL(join(process.cwd(), 'server', 'worldAgent.js')).href)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    const toolResult = worldAgent.executeWorldTool('enter_scene', { sceneId: 'scene_city_street' });
    const after = worldDb.getWorldOverview();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ toolResult, after }));
  `);

  assert.equal(result.toolResult.ok, false);
  assert.match(result.toolResult.error, /未知工具/);
  assert.equal(result.after.currentScene.scene.id, 'scene_bus_station');
  assert.equal(result.after.time.clock.absoluteMinutes, 720);
});

test('world agent rejects relationship-form player location patches', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(pathToFileURL(join(process.cwd(), 'server', 'worldAgent.js')).href)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    const setResult = worldAgent.executeWorldTool('apply_world_patch', {
      operations: [{
        op: 'set_relationship',
        sourceEntityId: 'player',
        targetEntityId: 'scene_city_street',
        relationshipType: 'located_in',
      }],
    }, '测试关系形式的位置绕过');
    const deleteResult = worldAgent.executeWorldTool('apply_world_patch', {
      operations: [{
        op: 'delete_relationship',
        sourceEntityId: 'player',
        targetEntityId: 'scene_bus_station',
        relationshipType: 'located_in',
      }],
      confirmedTargetIds: ['player', 'scene_bus_station'],
    }, '测试删除当前位置关系');
    const after = worldDb.getWorldOverview();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ setResult, deleteResult, after }));
  `);

  assert.equal(result.setResult.ok, false);
  assert.match(result.setResult.error, /transition_scene/);
  assert.equal(result.deleteResult.ok, false);
  assert.match(result.deleteResult.error, /transition_scene/);
  assert.equal(result.after.currentScene.scene.id, 'scene_bus_station');
  assert.equal(result.after.time.clock.absoluteMinutes, 720);
});

test('time checkpoint exposes only unsettled story events and prevents double counting', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();

    const initial = worldDb.getWorldTimeContext();
    worldDb.addConversation('user', 'player', '玩家', '和玉芬交谈后睡到晚上八点。');
    worldDb.addConversation('assistant', null, '世界 Agent', '天色已经完全暗了。');
    const beforeSettlement = worldDb.getWorldTimeContext();
    const firstSettlement = worldDb.updateWorldTime({
      timeSegments: [
        { label: '简短交谈', minutes: 10, evidence: '玩家与玉芬交换信息。' },
        { label: '睡到晚上八点', minutes: 470, evidence: '明确绝对时间锚点为 20:00。' },
      ],
      throughConversationId: beforeSettlement.latestConversationId,
      reason: '根据明确时间锚点结算场景内经过时间。',
      summary: '玩家交谈后休息至晚上八点。',
    });
    const afterFirstSettlement = worldDb.getWorldTimeContext();

    worldDb.addConversation('user', 'player', '玩家', '整理装备并再次询问情况。');
    const beforeSecondSettlement = worldDb.getWorldTimeContext();
    const secondSettlement = worldDb.updateWorldTime({
      timeSegments: [{ label: '整理装备', minutes: 10, evidence: '检查并收拢装备。' }],
      throughConversationId: beforeSecondSettlement.latestConversationId,
      reason: '结算检查点之后的新剧情。',
      summary: '玩家完成出发准备。',
    });
    const afterSecondSettlement = worldDb.getWorldTimeContext();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({
      initial,
      beforeSettlement,
      firstSettlement,
      afterFirstSettlement,
      beforeSecondSettlement,
      secondSettlement,
      afterSecondSettlement,
    }));
  `);

  assert.equal(result.initial.checkpoint.clock.fullLabel, '第 1 日 12:00');
  assert.equal(result.beforeSettlement.pendingEvents.length, 2);
  assert.equal(result.firstSettlement.elapsedMinutes, 480);
  assert.equal(result.firstSettlement.clockAfter.fullLabel, '第 1 日 20:00');
  assert.equal(result.afterFirstSettlement.pendingEvents.length, 0);
  assert.equal(result.beforeSecondSettlement.pendingEvents.length, 1);
  assert.equal(result.secondSettlement.clockAfter.fullLabel, '第 1 日 20:10');
  assert.equal(result.afterSecondSettlement.pendingEvents.length, 0);
  assert.equal(
    result.afterSecondSettlement.checkpoint.conversationCursor,
    result.beforeSecondSettlement.latestConversationId,
  );
});

test('scene transition settles new scene events plus travel after an earlier time query', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.getWorldTimeContext();

    worldDb.addConversation('user', 'player', '玩家', '睡到晚上八点。');
    const sleepContext = worldDb.getWorldTimeContext();
    worldDb.updateWorldTime({
      timeSegments: [{ label: '睡眠', minutes: 480, evidence: '从 12:00 睡到 20:00。' }],
      throughConversationId: sleepContext.latestConversationId,
      reason: '玩家查询时间时结算睡眠。',
      summary: '玩家睡到晚上八点。',
    });

    worldDb.addConversation('user', 'player', '玩家', '与玉芬交谈并整理装备。');
    const transitionContext = worldDb.getWorldTimeContext();
    const transition = worldDb.transitionScene('scene_city_street', {
      sceneTimeSegments: [{ label: '交谈和整理装备', minutes: 10, evidence: '检查点之后的新剧情。' }],
      travelMinutes: 25,
      travelReason: '沿客运站出口前往城里街面。',
      throughConversationId: transitionContext.latestConversationId,
      previousSceneSummary: '玩家休息、交谈并完成出发准备。',
    });
    const after = worldDb.getWorldTimeContext();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ transition, after }));
  `);

  assert.equal(result.transition.sceneElapsedMinutes, 10);
  assert.equal(result.transition.travelMinutes, 25);
  assert.equal(result.transition.elapsedMinutes, 35);
  assert.equal(result.transition.clockAfter.fullLabel, '第 1 日 20:35');
  assert.equal(result.transition.completedVisit.elapsedMinutes, 515);
  assert.equal(result.after.pendingEvents.length, 0);
  assert.equal(result.after.checkpoint.sceneId, 'scene_city_street');
});

test('scene transition cannot leave pending story events behind', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.getWorldTimeContext();
    worldDb.addConversation('user', 'player', '玩家', '先和玉芬谈话。');
    worldDb.addConversation('user', 'player', '玩家', '然后整理装备准备出发。');
    const context = worldDb.getWorldTimeContext();
    let error = '';
    try {
      worldDb.transitionScene('scene_city_street', {
        sceneTimeSegments: [{ label: '只分析第一条事件', minutes: 5, evidence: 'Only the first event was reviewed.' }],
        travelMinutes: 25,
        travelReason: '前往城里街面。',
        throughConversationId: context.pendingEvents[0].id,
        previousSceneSummary: '错误地遗漏了后续剧情。',
      });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const after = worldDb.getWorldOverview();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ context, error, after }));
  `);

  assert.match(result.error, /全部未结算剧情/);
  assert.equal(result.after.currentScene.scene.id, 'scene_bus_station');
  assert.equal(result.after.time.clock.absoluteMinutes, 720);
  assert.equal(result.after.time.pendingEventCount, 2);
});

test('world agent can settle queried time from pending story events', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(pathToFileURL(join(process.cwd(), 'server', 'worldAgent.js')).href)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.getWorldTimeContext();
    worldDb.addConversation('user', 'player', '玩家', '睡到晚上十点再叫醒我。');
    const timeState = worldAgent.executeWorldTool('get_time_state', {});
    const settlement = worldAgent.executeWorldTool('update_time', {
      timeSegments: [{ label: '睡到晚上十点', minutes: 600, evidence: '明确绝对时间为 22:00。' }],
      throughConversationId: timeState.timeContext.latestConversationId,
      reason: '根据玩家明确指定的醒来时间结算。',
      summary: '玩家从中午休息至晚上十点。',
    });
    const after = worldDb.getWorldTimeContext();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ timeState, settlement, after }));
  `);

  assert.equal(result.timeState.ok, true);
  assert.equal(result.timeState.timeContext.pendingEvents.length, 1);
  assert.equal(result.settlement.ok, true);
  assert.equal(result.settlement.clockAfter.fullLabel, '第 1 日 22:00');
  assert.equal(result.after.pendingEvents.length, 0);
});

test('legacy scene transition timing cannot bypass pending story settlement', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.getWorldTimeContext();
    worldDb.addConversation('user', 'player', 'Player', 'Sleep until 22:00.');
    let error = '';
    try {
      worldDb.transitionScene('scene_city_street', {
        elapsedMinutes: 25,
        elapsedReason: 'Travel to the gate.',
        previousSceneSummary: 'The player slept and then departed.',
      });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const after = worldDb.getWorldOverview();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ error, after }));
  `);

  assert.match(result.error, /sceneTimeSegments/);
  assert.equal(result.after.time.clock.absoluteMinutes, 720);
  assert.equal(result.after.time.pendingEventCount, 1);
  assert.equal(result.after.currentScene.scene.id, 'scene_bus_station');
});

test('replaying a settled conversation cursor cannot advance time twice', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.getWorldTimeContext();
    worldDb.addConversation('user', 'player', 'Player', 'Inspect the room for ten minutes.');
    const context = worldDb.getWorldTimeContext();
    const input = {
      timeSegments: [{ label: 'Inspect the room', minutes: 10, evidence: 'The inspection took ten minutes.' }],
      throughConversationId: context.latestConversationId,
      reason: 'Settle the inspection.',
      summary: 'The room was inspected.',
    };
    worldDb.updateWorldTime(input);
    let error = '';
    try {
      worldDb.updateWorldTime(input);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const after = worldDb.getWorldTimeState();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ error, after }));
  `);

  assert.match(result.error, /already settled|already been settled|nonzero/i);
  assert.equal(result.after.clock.absoluteMinutes, 730);
});

test('scene transition cannot add scene time when no story events are pending', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    const context = worldDb.getWorldTimeContext();
    let error = '';
    try {
      worldDb.transitionScene('scene_city_street', {
        sceneTimeSegments: [{ label: 'Already-settled rest', minutes: 480, evidence: 'This rest was already settled.' }],
        travelMinutes: 25,
        travelReason: 'Travel to the gate.',
        throughConversationId: context.latestConversationId,
        previousSceneSummary: 'Departed after resting.',
      });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const after = worldDb.getWorldOverview();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ error, after }));
  `);

  assert.match(result.error, /no pending story events|nonzero/i);
  assert.equal(result.after.time.clock.absoluteMinutes, 720);
  assert.equal(result.after.currentScene.scene.id, 'scene_bus_station');
});

test('an explicit clock target rejects an inconsistent short duration', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.getWorldTimeContext();
    worldDb.addConversation('user', 'player', 'Player', 'Sleep until 22:00.');
    const context = worldDb.getWorldTimeContext();
    let error = '';
    try {
      worldDb.updateWorldTime({
        timeSegments: [{ label: 'Sleep until 22:00', minutes: 25, evidence: 'Wake at 22:00.' }],
        throughConversationId: context.latestConversationId,
        reason: 'Settle the sleep.',
        summary: 'The player slept until 22:00.',
      });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const after = worldDb.getWorldTimeState();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ error, after }));
  `);

  assert.match(result.error, /22:00|explicit clock target/i);
  assert.equal(result.after.clock.absoluteMinutes, 720);
  assert.equal(result.after.pendingEventCount, 1);
});

test('scene transition cannot swallow a pending absolute-time action with empty segments', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.getWorldTimeContext();
    worldDb.addConversation('user', 'player', 'Player', 'Sleep until 22:00, then leave.');
    const context = worldDb.getWorldTimeContext();
    let error = '';
    try {
      worldDb.transitionScene('scene_city_street', {
        sceneTimeSegments: [],
        travelMinutes: 25,
        travelReason: 'Travel to the gate.',
        throughConversationId: context.latestConversationId,
        previousSceneSummary: 'The player slept and departed.',
      });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const after = worldDb.getWorldOverview();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ error, after }));
  `);

  assert.match(result.error, /22:00|absolute-time action/i);
  assert.equal(result.after.time.clock.absoluteMinutes, 720);
  assert.equal(result.after.time.pendingEventCount, 1);
});

test('raw pending time evidence cannot be omitted from a short generic settlement', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.getWorldTimeContext();
    worldDb.addConversation('user', 'player', 'Player', 'Sleep until 22:00.');
    const context = worldDb.getWorldTimeContext();
    let error = '';
    try {
      worldDb.updateWorldTime({
        timeSegments: [{ label: 'Rest', minutes: 25, evidence: 'The player rested for a while.' }],
        throughConversationId: context.latestConversationId,
        reason: 'Settle the rest.',
        summary: 'The player rested.',
      });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const after = worldDb.getWorldTimeState();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ error, after }));
  `);

  assert.match(result.error, /22:00|absolute-time action/i);
  assert.equal(result.after.clock.absoluteMinutes, 720);
  assert.equal(result.after.pendingEventCount, 1);
});

test('tomorrow clock targets preserve their day offset', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.getWorldTimeContext();
    worldDb.addConversation('user', 'player', 'Player', 'Sleep until tomorrow 22:00.');
    const context = worldDb.getWorldTimeContext();
    const settlement = worldDb.updateWorldTime({
      timeSegments: [{ label: 'Sleep until tomorrow 22:00', minutes: 2040, evidence: 'Wake tomorrow at 22:00.' }],
      throughConversationId: context.latestConversationId,
      reason: 'Settle the overnight sleep.',
      summary: 'The player woke on the next night.',
    });
    worldDb.closeWorldDb();
    console.log(JSON.stringify(settlement));
  `);

  assert.equal(result.elapsedMinutes, 2040);
  assert.equal(result.clockAfter.fullLabel, '第 2 日 22:00');
});

test('Chinese absolute-time actions are enforced from the raw pending story', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.getWorldTimeContext();
    worldDb.addConversation('user', 'player', '玩家', '我想睡到晚上十点再叫醒我。');
    const context = worldDb.getWorldTimeContext();
    let error = '';
    try {
      worldDb.updateWorldTime({
        timeSegments: [{ label: '休息片刻', minutes: 25, evidence: '玩家休息了一会儿。' }],
        throughConversationId: context.latestConversationId,
        reason: '结算休息时间。',
        summary: '玩家完成休息。',
      });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const after = worldDb.getWorldTimeState();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ error, after }));
  `);

  assert.match(result.error, /22:00|absolute-time action/i);
  assert.equal(result.after.clock.absoluteMinutes, 720);
});

test('a later explicit cancellation clears an earlier sleep target', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.getWorldTimeContext();
    worldDb.addConversation('user', 'player', '玩家', '我想睡到晚上十点。');
    worldDb.addConversation('user', 'player', '玩家', '算了，不睡了，现在就出发。');
    const context = worldDb.getWorldTimeContext();
    const transition = worldDb.transitionScene('scene_city_street', {
      sceneTimeSegments: [],
      travelMinutes: 25,
      travelReason: '沿碎石路前往城里街面。',
      throughConversationId: context.latestConversationId,
      previousSceneSummary: '玩家改变主意后立即出发。',
    });
    worldDb.closeWorldDb();
    console.log(JSON.stringify(transition));
  `);

  assert.equal(result.sceneElapsedMinutes, 0);
  assert.equal(result.clockAfter.fullLabel, '第 1 日 12:25');
});

function runIsolatedWorldScript(script) {
  const cwd = mkdtempSync(join(tmpdir(), 'newchat-world-time-'));
  try {
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd,
      encoding: 'utf8',
    });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    const lines = child.stdout.trim().split(/\r?\n/);
    return JSON.parse(lines.at(-1) || 'null');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
