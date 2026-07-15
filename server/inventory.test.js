import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const WORLD_DB_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'worldDb.js')).href;
const INVENTORY_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'inventory.js')).href;
const WORLD_ACTIONS_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'worldActions.js')).href;
const WORLD_AGENT_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'worldAgent.js')).href;

test('inventory reads ownership as canonical state and migrates legacy item ids', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.deleteRelationship('player', 'item_iron_sword', 'ownership');
    inventoryApi.ensureInventoryConsistency();
    const inventory = inventoryApi.getInventory();
    worldDb.closeWorldDb();
    console.log(JSON.stringify(inventory));
  `);

  assert.equal(result.totalQuantity, 4);
  assert.equal(result.items.find((item) => item.id === 'item_ash_tonic').quantity, 2);
  assert.equal(result.items.find((item) => item.id === 'item_iron_sword').equipped, true);
  assert.match(result.items.find((item) => item.id === 'item_crown_mark').actions.find((action) => action.kind === 'item.drop').disabledReason, /不能丢弃/);
});

test('using a healing item updates hit points and consumes quantity atomically', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    inventoryApi.ensureInventoryConsistency();
    worldDb.upsertComponent('player', 'stats', { ...worldDb.getComponent('player', 'stats'), currentHitPoints: 5 });
    const first = inventoryApi.executeInventoryAction({ kind: 'item.use', itemId: 'item_ash_tonic', targetId: 'player' });
    const second = inventoryApi.executeInventoryAction({ kind: 'item.use', itemId: 'item_ash_tonic', targetId: 'player' });
    const ownership = worldDb.listRelationships({ entityId: 'player', direction: 'out', type: 'ownership' })
      .find((relationship) => relationship.targetEntityId === 'item_ash_tonic') || null;
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ first, second, ownership }));
  `);

  assert.equal(result.first.result.facts.hpBefore, 5);
  assert.equal(result.first.result.facts.hpAfter, 9);
  assert.equal(result.first.result.facts.quantityAfter, 1);
  assert.equal(result.second.result.facts.hpAfter, 12);
  assert.equal(result.second.result.facts.restoredHitPoints, 3);
  assert.equal(result.second.result.facts.quantityAfter, 0);
  assert.equal(result.ownership, null);
});

test('equipped items must be unequipped before drop and can be picked up again', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    inventoryApi.ensureInventoryConsistency();
    let blocked = '';
    try {
      inventoryApi.executeInventoryAction({ kind: 'item.drop', itemId: 'item_iron_sword' });
    } catch (error) {
      blocked = error instanceof Error ? error.message : String(error);
    }
    inventoryApi.executeInventoryAction({ kind: 'item.unequip', itemId: 'item_iron_sword' });
    const dropped = inventoryApi.executeInventoryAction({ kind: 'item.drop', itemId: 'item_iron_sword' });
    const pickedUp = inventoryApi.executeInventoryAction({ kind: 'item.pickup', itemId: 'item_iron_sword' });
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ blocked, dropped, pickedUp }));
  `);

  assert.match(result.blocked, /先卸下/);
  assert.ok(result.dropped.inventory.nearbyItems.some((item) => item.id === 'item_iron_sword'));
  assert.ok(result.pickedUp.inventory.items.some((item) => item.id === 'item_iron_sword'));
  assert.ok(!result.pickedUp.inventory.nearbyItems.some((item) => item.id === 'item_iron_sword'));
});

test('weapon attacks reject a weapon that is no longer equipped', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    const worldActions = await import(${JSON.stringify(WORLD_ACTIONS_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    inventoryApi.ensureInventoryConsistency();
    const availableBefore = worldActions.listWorldActions({ actorId: 'player', targetId: 'character_elena' }).actions;
    inventoryApi.executeInventoryAction({ kind: 'item.unequip', itemId: 'item_iron_sword' });
    let error = '';
    try {
      worldActions.executeWorldAction({
        kind: 'attack.weapon',
        actorId: 'player',
        targetId: 'character_elena',
        weaponId: 'item_iron_sword',
      });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ availableBefore, error }));
  `);

  assert.equal(result.availableBefore[0]?.kind, 'attack.weapon');
  assert.match(result.error, /不能执行/);
});

test('weapon attacks accept the same mechanical weapon classification as inventory equip', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    const worldActions = await import(${JSON.stringify(WORLD_ACTIONS_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    inventoryApi.ensureInventoryConsistency();
    const identity = worldDb.getComponent('item_iron_sword', 'identity') || {};
    worldDb.upsertComponent('item_iron_sword', 'identity', { ...identity, role: 'relic' });
    const actions = worldActions.listWorldActions({ actorId: 'player', targetId: 'character_elena' }).actions;
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ actions }));
  `);

  assert.equal(result.actions[0]?.kind, 'attack.weapon');
  assert.equal(result.actions[0]?.weaponId, 'item_iron_sword');
});

test('dropping and picking up a stack preserves its quantity', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    inventoryApi.ensureInventoryConsistency();
    const dropped = inventoryApi.executeInventoryAction({ kind: 'item.drop', itemId: 'item_ash_tonic' });
    const location = worldDb.listRelationships({ entityId: 'item_ash_tonic', direction: 'out', type: 'located_in' })[0];
    const pickedUp = inventoryApi.executeInventoryAction({ kind: 'item.pickup', itemId: 'item_ash_tonic' });
    const ownership = worldDb.listRelationships({ entityId: 'player', direction: 'out', type: 'ownership' })
      .find((relationship) => relationship.targetEntityId === 'item_ash_tonic');
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ dropped, location, pickedUp, ownership }));
  `);

  assert.equal(result.dropped.inventory.nearbyItems.find((item) => item.id === 'item_ash_tonic').quantity, 2);
  assert.equal(result.location.data.quantity, 2);
  assert.equal(result.pickedUp.result.facts.quantity, 2);
  assert.equal(result.ownership.data.quantity, 2);
  assert.equal(result.pickedUp.inventory.items.find((item) => item.id === 'item_ash_tonic').quantity, 2);
});

test('inventory nearby items and pickup use the requested actor actual scene', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    inventoryApi.ensureInventoryConsistency();
    worldDb.deleteRelationship('player', 'item_ash_tonic', 'ownership');
    worldDb.setCurrentLocation('item_ash_tonic', 'scene_people_theater', 'test');
    const location = worldDb.listRelationships({ entityId: 'item_ash_tonic', direction: 'out', type: 'located_in' })[0];
    worldDb.upsertRelationship('item_ash_tonic', 'scene_people_theater', 'located_in', location.value, {
      ...location.data,
      quantity: 3,
    });
    const playerInventory = inventoryApi.getInventory('player');
    const actorInventory = inventoryApi.getInventory('character_kaen');
    const pickedUp = inventoryApi.executeInventoryAction({
      kind: 'item.pickup',
      actorId: 'character_kaen',
      itemId: 'item_ash_tonic',
    });
    const ownership = worldDb.listRelationships({ entityId: 'character_kaen', direction: 'out', type: 'ownership' })
      .find((relationship) => relationship.targetEntityId === 'item_ash_tonic');
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ playerInventory, actorInventory, pickedUp, ownership }));
  `);

  assert.ok(!result.playerInventory.nearbyItems.some((item) => item.id === 'item_ash_tonic'));
  assert.equal(result.actorInventory.nearbyItems.find((item) => item.id === 'item_ash_tonic').quantity, 3);
  assert.equal(result.pickedUp.result.facts.sceneId, 'scene_people_theater');
  assert.equal(result.ownership.data.quantity, 3);
});

test('provided targets are rejected when an action has no valid targets', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.upsertEntity('scene_inventory_test', 'scene', 'Inventory test scene');
    worldDb.upsertEntity('faction_inventory_test', 'faction', 'Inventory test actor');
    worldDb.setCurrentLocation('faction_inventory_test', 'scene_inventory_test', 'test');
    worldDb.deleteRelationship('player', 'item_crown_mark', 'ownership');
    worldDb.upsertRelationship('faction_inventory_test', 'item_crown_mark', 'ownership', null, { quantity: 1 });
    const inventory = inventoryApi.getInventory('faction_inventory_test');
    const action = inventory.items.find((item) => item.id === 'item_crown_mark').actions
      .find((candidate) => candidate.kind === 'item.present');
    let error = '';
    try {
      inventoryApi.executeInventoryAction({
        kind: 'item.present',
        actorId: 'faction_inventory_test',
        itemId: 'item_crown_mark',
        targetId: 'missing_target',
      });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ action, error }));
  `);

  assert.deepEqual(result.action.validTargetIds, []);
  assert.match(result.error, /目标/);
});

test('world agent inventory tools reuse the same validated action service', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(WORLD_AGENT_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.upsertComponent('player', 'stats', { ...worldDb.getComponent('player', 'stats'), currentHitPoints: 7 });
    const read = worldAgent.executeWorldTool('get_inventory', {});
    const used = worldAgent.executeWorldTool('execute_item_action', {
      actionKind: 'item.use',
      itemId: 'item_ash_tonic',
      targetId: 'player',
    });
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ read, used }));
  `);

  assert.equal(result.read.ok, true);
  assert.ok(result.read.inventory.items.some((item) => item.id === 'item_ash_tonic'));
  assert.equal(result.used.ok, true);
  assert.equal(result.used.result.facts.hpAfter, 11);
  assert.equal(result.used.inventory.items.find((item) => item.id === 'item_ash_tonic').quantity, 1);
});

function runIsolatedInventoryScript(script) {
  const cwd = mkdtempSync(join(tmpdir(), 'newchat-inventory-'));
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
