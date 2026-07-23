import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const WORLD_DB_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'worldDb.js')).href;
const WORLD_AGENT_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'worldAgent.js')).href;

test('leave_scene removes a character with unknown whereabouts without deleting the entity', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(WORLD_AGENT_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();

    const toolResult = worldAgent.executeWorldTool('leave_scene', {
      departures: [{
        entityId: 'character_wandering_child',
        reason: '被玩家赶离客运站。',
      }],
    });
    const currentScene = worldDb.getCurrentScene();
    const event = worldDb.listEvents(40, 'character_wandering_child')
      .find((candidate) => candidate.type === 'entity.left_scene');
    const prepared = worldAgent.prepareToolResultForAgentStep('leave_scene', toolResult);
    const output = {
      toolOk: toolResult.ok,
      departure: toolResult.departures?.[0],
      prepared,
      currentResidentIds: currentScene.residents.map((entity) => entity.id),
      currentLocationId: worldDb.getCurrentLocationId('character_wandering_child'),
      entityStillExists: Boolean(worldDb.getEntity('character_wandering_child')),
      event,
    };
    worldDb.closeWorldDb();
    console.log(JSON.stringify(output));
  `);

  assert.equal(result.toolOk, true);
  assert.equal(result.departure.destinationSceneId, null);
  assert.equal(result.currentLocationId, null);
  assert.equal(result.entityStillExists, true);
  assert.ok(!result.currentResidentIds.includes('character_wandering_child'));
  assert.equal(result.event.payload.fromSceneId, 'scene_bus_station');
  assert.equal(result.event.payload.destinationSceneId, null);
  assert.equal(result.event.payload.reason, '被玩家赶离客运站。');
  assert.equal(result.prepared.departures[0].fromSceneName, '城市客运站');
  assert.equal(result.prepared.scene, undefined);
});

test('leave_scene handles multiple departures with known and unknown destinations together', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(WORLD_AGENT_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.setCurrentLocation('character_erhu_busker', 'scene_bus_station', 'test', '测试多人离场。');

    const toolResult = worldAgent.executeWorldTool('leave_scene', {
      departures: [
        {
          entityId: 'character_wandering_child',
          destinationSceneId: 'scene_city_street',
          reason: '孩子们转去街面寻找落脚处。',
        },
        {
          entityId: 'character_erhu_busker',
          reason: '卖艺人收起二胡后独自离开。',
        },
      ],
    });
    const currentScene = worldDb.getCurrentScene();
    const output = {
      toolOk: toolResult.ok,
      departureCount: toolResult.departures?.length,
      currentResidentIds: currentScene.residents.map((entity) => entity.id),
      childLocationId: worldDb.getCurrentLocationId('character_wandering_child'),
      buskerLocationId: worldDb.getCurrentLocationId('character_erhu_busker'),
      eventCount: worldDb.listEvents(40).filter((event) => event.type === 'entity.left_scene').length,
    };
    worldDb.closeWorldDb();
    console.log(JSON.stringify(output));
  `);

  assert.equal(result.toolOk, true);
  assert.equal(result.departureCount, 2);
  assert.equal(result.childLocationId, 'scene_city_street');
  assert.equal(result.buskerLocationId, null);
  assert.ok(!result.currentResidentIds.includes('character_wandering_child'));
  assert.ok(!result.currentResidentIds.includes('character_erhu_busker'));
  assert.equal(result.eventCount, 2);
});

test('leave_scene rejects the player and rolls back every departure in the batch', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(WORLD_AGENT_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();

    const toolResult = worldAgent.executeWorldTool('leave_scene', {
      departures: [
        {
          entityId: 'character_wandering_child',
          reason: '先处理的有效人物。',
        },
        {
          entityId: 'player',
          reason: '试图绕过玩家场景切换。',
        },
      ],
    });
    const output = {
      toolResult,
      childLocationId: worldDb.getCurrentLocationId('character_wandering_child'),
      playerLocationId: worldDb.getCurrentLocationId('player'),
      departureEventCount: worldDb.listEvents(40).filter((event) => event.type === 'entity.left_scene').length,
    };
    worldDb.closeWorldDb();
    console.log(JSON.stringify(output));
  `);

  assert.equal(result.toolResult.ok, false);
  assert.match(result.toolResult.error, /transition_scene/);
  assert.equal(result.childLocationId, 'scene_bus_station');
  assert.equal(result.playerLocationId, 'scene_bus_station');
  assert.equal(result.departureEventCount, 0);
});

function runIsolatedWorldScript(script) {
  const cwd = mkdtempSync(join(tmpdir(), 'newchat-scene-departure-'));
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
