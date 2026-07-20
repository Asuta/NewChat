import assert from 'node:assert/strict';
import test from 'node:test';
import { seedMaDashuaiWorld } from './defaultWorld.js';

test('预制世界使用马大帅进城背景并为每个人物提供有效生命值', () => {
  const characters = new Map();
  const statsByEntityId = new Map();
  const meta = new Map();

  seedMaDashuaiWorld({
    upsertEntity(entityId, kind, name) {
      if (kind === 'character') characters.set(entityId, name);
    },
    setAliases() {},
    upsertComponent(entityId, componentType, data) {
      if (componentType === 'stats') statsByEntityId.set(entityId, data);
    },
    upsertRelationship() {},
    setMeta(key, value) {
      meta.set(key, value);
    },
    addEvent() {},
  });

  const expectedHitPoints = new Map([
    ['character_yufen', 14],
    ['character_fan_debiao', 18],
    ['character_ma_xiaocui', 12],
    ['character_guiying', 14],
    ['character_wu', 16],
    ['character_awei', 12],
    ['character_yu_fugui', 16],
    ['character_gangzi', 20],
  ]);

  assert.equal(meta.get('campaignId'), 'ma-dashuai-city-life');
  assert.equal(meta.get('campaignTitle'), '马大帅：进城以后');
  assert.equal(meta.get('currentSceneId'), 'scene_bus_station');
  assert.deepEqual([...characters.keys()].sort(), [...expectedHitPoints.keys()].sort());

  for (const [entityId, maxHitPoints] of expectedHitPoints) {
    const stats = statsByEntityId.get(entityId);
    assert.ok(stats, `${characters.get(entityId)} 缺少 stats 组件`);
    assert.equal(stats.maxHitPoints, maxHitPoints);
    assert.equal(stats.currentHitPoints, maxHitPoints);
  }
});
