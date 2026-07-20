import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MA_DASHUAI_CHARACTER_HIT_POINTS,
  seedMaDashuaiWorld,
} from './defaultWorld.js';

test('预制世界按第一集检查点提供完整且自洽的马大帅人物、场景和剧情数据', () => {
  const entities = new Map();
  const components = new Map();
  const relationships = [];
  const meta = new Map();

  seedMaDashuaiWorld({
    upsertEntity(entityId, kind, name) {
      entities.set(entityId, { id: entityId, kind, name });
    },
    setAliases() {},
    upsertComponent(entityId, componentType, data) {
      components.set(`${entityId}:${componentType}`, data);
    },
    upsertRelationship(sourceEntityId, targetEntityId, type, value, data) {
      relationships.push({ sourceEntityId, targetEntityId, type, value, data });
    },
    setMeta(key, value) {
      meta.set(key, value);
    },
    addEvent() {},
  });

  assert.equal(meta.get('campaignId'), 'ma-dashuai-city-life');
  assert.equal(meta.get('campaignTitle'), '马大帅：进城以后');
  assert.equal(meta.get('currentSceneId'), 'scene_bus_station');
  assert.equal(meta.get('campaignEpisode'), '1');
  assert.equal(meta.get('presetRevision'), 'ma-dashuai-episode-guide-v2');
  assert.match(meta.get('storyCheckpoint'), /钱包和范德彪地址被偷/);

  const expectedCharacters = Object.keys(MA_DASHUAI_CHARACTER_HIT_POINTS).sort();
  const actualCharacters = [...entities.values()]
    .filter((entity) => entity.kind === 'character')
    .map((entity) => entity.id)
    .sort();
  assert.deepEqual(actualCharacters, expectedCharacters);
  assert.equal(actualCharacters.length, 20);

  const expectedScenes = [
    'scene_bus_station',
    'scene_city_street',
    'scene_victoria',
    'scene_debiao_home',
    'scene_xiaoyun_home',
    'scene_detention_center',
    'scene_victoria_restaurant',
    'scene_guiying_restaurant',
    'scene_bathhouse',
    'scene_bar',
    'scene_hospital',
    'scene_gao_home',
    'scene_wang_boxing_room',
    'scene_fishing_park',
    'scene_su_home',
    'scene_oldscar_hideout',
    'scene_jail_visiting_room',
    'scene_majia_village',
    'scene_migrant_school',
  ].sort();
  const actualScenes = [...entities.values()]
    .filter((entity) => entity.kind === 'scene')
    .map((entity) => entity.id)
    .sort();
  assert.deepEqual(actualScenes, expectedScenes);

  for (const [entityId, maxHitPoints] of Object.entries(MA_DASHUAI_CHARACTER_HIT_POINTS)) {
    const stats = components.get(`${entityId}:stats`);
    assert.ok(stats, `${entities.get(entityId)?.name || entityId} 缺少 stats 组件`);
    assert.equal(stats.maxHitPoints, maxHitPoints);
    assert.equal(stats.currentHitPoints, maxHitPoints);
    assert.ok(components.get(`${entityId}:identity`), `${entityId} 缺少 identity 组件`);
    assert.ok(components.get(`${entityId}:status`), `${entityId} 缺少 status 组件`);
  }

  for (const relationship of relationships) {
    assert.ok(entities.has(relationship.sourceEntityId), `关系来源不存在：${relationship.sourceEntityId}`);
    assert.ok(entities.has(relationship.targetEntityId), `关系目标不存在：${relationship.targetEntityId}`);
  }

  const findRelationship = (sourceEntityId, targetEntityId, type) => relationships.find(
    (relationship) => relationship.sourceEntityId === sourceEntityId
      && relationship.targetEntityId === targetEntityId
      && relationship.type === type,
  );

  assert.ok(findRelationship('player', 'scene_bus_station', 'located_in'));
  assert.ok(findRelationship('character_yufen', 'scene_majia_village', 'located_in'));
  assert.ok(findRelationship('character_ma_xiaocui', 'scene_victoria', 'located_in'));
  assert.ok(findRelationship('character_gangzi', 'scene_city_street', 'located_in'));
  assert.equal(findRelationship('character_yufen', 'scene_bus_station', 'located_in'), undefined);
  assert.equal(findRelationship('character_ma_xiaocui', 'character_gangzi', 'affinity'), undefined);

  assert.ok(findRelationship('character_erhu_busker', 'item_erhu', 'ownership'));
  assert.equal(findRelationship('player', 'item_erhu', 'ownership'), undefined);
  assert.equal(findRelationship('player', 'item_lost_wallet', 'related_to')?.data.state, 'lost');
  assert.equal(findRelationship('player', 'item_lost_address', 'related_to')?.data.state, 'lost');

  const inventory = components.get('player:inventory');
  assert.deepEqual(inventory.items, ['item_luggage_bundle', 'item_wooden_pole', 'item_honghua_oil']);
  assert.ok(!inventory.items.includes('item_erhu'));

  const mainQuest = components.get('quest_main:quest');
  assert.equal(mainQuest.status, 'active');
  assert.equal(mainQuest.phaseStatus, 'episode_1');
  assert.match(mainQuest.currentGuidance, /钱包和范德彪地址已经被偷/);
  assert.doesNotMatch(mainQuest.currentGuidance, /玉芬说话|撕破的地址/);

  assert.equal(components.get('quest_build_school:quest').phaseStatus, 'hidden');
  assert.equal(components.get('scene_migrant_school:scene').visibility, 'hidden');
  assert.equal(components.get('item_su_will:identity').availability, 'future');
});
