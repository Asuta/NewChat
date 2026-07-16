import assert from 'node:assert/strict';
import test from 'node:test';
import { seedSevenDayCrownWorld } from './defaultWorld.js';

test('预制世界中的每个人物都有有效的初始生命值', () => {
  const characters = new Map();
  const statsByEntityId = new Map();

  seedSevenDayCrownWorld({
    upsertEntity(entityId, kind, name) {
      if (kind === 'character') characters.set(entityId, name);
    },
    setAliases() {},
    upsertComponent(entityId, componentType, data) {
      if (componentType === 'stats') statsByEntityId.set(entityId, data);
    },
    upsertRelationship() {},
    setMeta() {},
    addEvent() {},
  });

  const expectedHitPoints = new Map([
    ['character_elena', 22],
    ['character_rowan', 14],
    ['character_milo', 10],
    ['character_aldric', 30],
    ['character_eve', 18],
    ['character_kaen', 20],
    ['character_hollow_knight', 18],
    ['character_crown_will', 36],
  ]);

  assert.deepEqual([...characters.keys()].sort(), [...expectedHitPoints.keys()].sort());

  for (const [entityId, maxHitPoints] of expectedHitPoints) {
    const stats = statsByEntityId.get(entityId);
    assert.ok(stats, `${characters.get(entityId)}缺少 stats 组件`);
    assert.equal(stats.maxHitPoints, maxHitPoints);
    assert.equal(stats.currentHitPoints, maxHitPoints);
  }
});
