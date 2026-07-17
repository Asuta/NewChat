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

test('inventory keeps transferred items with their actual owner instead of restoring a stale legacy item id', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.deleteRelationship('player', 'item_iron_sword', 'ownership');
    worldDb.upsertRelationship('character_elena', 'item_iron_sword', 'ownership', null, { quantity: 1 });
    inventoryApi.ensureInventoryConsistency();
    const inventory = inventoryApi.getInventory();
    const playerInventoryComponent = worldDb.getComponent('player', 'inventory');
    const elenaOwnership = worldDb.listRelationships({ entityId: 'character_elena', direction: 'out', type: 'ownership' })
      .find((relationship) => relationship.targetEntityId === 'item_iron_sword') || null;
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ inventory, playerInventoryComponent, elenaOwnership }));
  `);

  assert.equal(result.inventory.totalQuantity, 3);
  assert.equal(result.inventory.items.find((item) => item.id === 'item_ash_tonic').quantity, 2);
  assert.ok(!result.inventory.items.some((item) => item.id === 'item_iron_sword'));
  assert.ok(!result.playerInventoryComponent.items.includes('item_iron_sword'));
  assert.equal('equippedWeaponId' in result.playerInventoryComponent, false);
  assert.equal(result.elenaOwnership.data.quantity, 1);
  assert.match(result.inventory.items.find((item) => item.id === 'item_crown_mark').actions.find((action) => action.kind === 'item.drop').disabledReason, /不能丢弃/);
});

test('startup playable-state repair preserves a transferred weapon owner', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.ensurePlayableCharacterStats();
    inventoryApi.ensureInventoryConsistency();
    inventoryApi.executeInventoryAction({
      kind: 'item.transfer',
      itemId: 'item_iron_sword',
      targetId: 'character_elena',
    });
    worldDb.ensurePlayableCharacterStats();
    inventoryApi.ensureInventoryConsistency();
    const owners = worldDb.listRelationships({ entityId: 'item_iron_sword', direction: 'in', type: 'ownership' })
      .map((relationship) => relationship.sourceEntityId);
    const playerInventory = inventoryApi.getInventory('player');
    const elenaInventory = inventoryApi.getInventory('character_elena');
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ owners, playerInventory, elenaInventory }));
  `);

  assert.deepEqual(result.owners, ['character_elena']);
  assert.ok(!result.playerInventory.items.some((item) => item.id === 'item_iron_sword'));
  assert.ok(result.elenaInventory.items.some((item) => item.id === 'item_iron_sword'));
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

test('the player can attack themself and healing restores hit-point incapacitation', () => {
  const result = runIsolatedInventoryScript(`
    Math.random = () => 0.99;
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    const worldActions = await import(${JSON.stringify(WORLD_ACTIONS_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    inventoryApi.ensureInventoryConsistency();
    const playerStats = worldDb.getComponent('player', 'stats') || {};
    worldDb.upsertComponent('player', 'stats', { ...playerStats, armorClass: 1, currentHitPoints: 1 });
    const selfActions = worldActions.listWorldActions({ actorId: 'player', targetId: 'player' }).actions;
    const attack = worldActions.executeWorldAction({
      kind: 'attack.weapon',
      actorId: 'player',
      targetId: 'player',
      weaponId: 'item_iron_sword',
    });
    const statusAfterAttack = worldDb.getComponent('player', 'status');
    const healing = inventoryApi.executeInventoryAction({
      kind: 'item.use',
      itemId: 'item_ash_tonic',
      targetId: 'player',
    });
    const statusAfterHealing = worldDb.getComponent('player', 'status');
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ selfActions, attack, statusAfterAttack, healing, statusAfterHealing }));
  `);

  assert.equal(result.selfActions[0]?.targetId, 'player');
  assert.equal(result.attack.result.action.targetId, 'player');
  assert.equal(result.attack.result.facts.hpAfter, 0);
  assert.equal(result.statusAfterAttack.incapacitatedReason, 'zero_hit_points');
  assert.equal(result.statusAfterAttack.canAct, false);
  assert.equal(result.healing.result.facts.restoredAction, true);
  assert.equal(result.statusAfterHealing.state, 'healthy');
  assert.equal(result.statusAfterHealing.canAct, true);
  assert.equal('incapacitatedReason' in result.statusAfterHealing, false);
});

test('healing preserves an incapacitating condition added after a hit-point knockout', () => {
  const result = runIsolatedInventoryScript(`
    Math.random = () => 0.99;
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    const worldActions = await import(${JSON.stringify(WORLD_ACTIONS_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    inventoryApi.ensureInventoryConsistency();
    const playerStats = worldDb.getComponent('player', 'stats') || {};
    worldDb.upsertComponent('player', 'stats', { ...playerStats, armorClass: 1, currentHitPoints: 1 });
    worldActions.executeWorldAction({
      kind: 'attack.weapon',
      actorId: 'player',
      targetId: 'player',
      weaponId: 'item_iron_sword',
    });
    const knockedOutStatus = worldDb.getComponent('player', 'status');
    worldDb.upsertComponent('player', 'status', {
      ...knockedOutStatus,
      label: '麻痹',
      description: '玩家倒地后又受到魔法麻痹。',
      conditions: [...(knockedOutStatus.conditions || []), 'paralyzed'],
    });
    const healing = inventoryApi.executeInventoryAction({
      kind: 'item.use',
      itemId: 'item_ash_tonic',
      targetId: 'player',
    });
    const statusAfterHealing = worldDb.getComponent('player', 'status');
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ healing, statusAfterHealing }));
  `);

  assert.equal(result.healing.result.facts.hpAfter > 0, true);
  assert.equal(result.healing.result.facts.restoredAction, false);
  assert.equal(result.statusAfterHealing.state, 'incapacitated');
  assert.equal(result.statusAfterHealing.label, '麻痹');
  assert.deepEqual(result.statusAfterHealing.conditions, ['paralyzed']);
  assert.equal(result.statusAfterHealing.canAct, false);
  assert.equal('incapacitatedReason' in result.statusAfterHealing, false);
  assert.equal('statusBeforeIncapacitation' in result.statusAfterHealing, false);
});

test('healing restores a legacy hit-point knockout without recovery metadata', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    inventoryApi.ensureInventoryConsistency();
    const playerStats = worldDb.getComponent('player', 'stats') || {};
    worldDb.upsertComponent('player', 'stats', { ...playerStats, currentHitPoints: 0 });
    worldDb.upsertComponent('player', 'status', {
      state: 'incapacitated',
      label: '失能',
      description: '失忆王选者 因伤势倒下，暂时无法行动。',
      canAct: false,
    });
    const healing = inventoryApi.executeInventoryAction({
      kind: 'item.use',
      itemId: 'item_ash_tonic',
      targetId: 'player',
    });
    const statusAfterHealing = worldDb.getComponent('player', 'status');
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ healing, statusAfterHealing }));
  `);

  assert.equal(result.healing.result.facts.restoredAction, true);
  assert.equal(result.statusAfterHealing.state, 'active');
  assert.equal(result.statusAfterHealing.canAct, true);
});

test('healing hit points does not clear incapacitation from another cause', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    inventoryApi.ensureInventoryConsistency();
    const playerStats = worldDb.getComponent('player', 'stats') || {};
    worldDb.upsertComponent('player', 'stats', { ...playerStats, currentHitPoints: 5 });
    worldDb.upsertComponent('player', 'status', {
      state: 'incapacitated',
      label: '麻痹',
      description: '玩家因魔法麻痹而无法行动。',
      canAct: false,
      conditions: ['paralyzed'],
    });
    const healing = inventoryApi.executeInventoryAction({
      kind: 'item.use',
      itemId: 'item_ash_tonic',
      targetId: 'player',
    });
    const statusAfterHealing = worldDb.getComponent('player', 'status');
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ healing, statusAfterHealing }));
  `);

  assert.equal(result.healing.result.facts.restoredAction, false);
  assert.equal(result.statusAfterHealing.label, '麻痹');
  assert.equal(result.statusAfterHealing.canAct, false);
});

test('owned weapons can be dropped and picked up without equipment state', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    inventoryApi.ensureInventoryConsistency();
    const dropped = inventoryApi.executeInventoryAction({ kind: 'item.drop', itemId: 'item_iron_sword' });
    const pickedUp = inventoryApi.executeInventoryAction({ kind: 'item.pickup', itemId: 'item_iron_sword' });
    const inventoryComponent = worldDb.getComponent('player', 'inventory');
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ dropped, pickedUp, inventoryComponent }));
  `);

  assert.ok(result.dropped.inventory.nearbyItems.some((item) => item.id === 'item_iron_sword'));
  assert.ok(result.pickedUp.inventory.items.some((item) => item.id === 'item_iron_sword'));
  assert.ok(!result.pickedUp.inventory.nearbyItems.some((item) => item.id === 'item_iron_sword'));
  assert.equal('equippedWeaponId' in result.inventoryComponent, false);
});

test('transferring an item moves the full owned quantity and synchronizes both legacy mirrors', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    inventoryApi.ensureInventoryConsistency();
    const transferred = inventoryApi.executeInventoryAction({
      kind: 'item.transfer',
      itemId: 'item_ash_tonic',
      targetId: 'character_elena',
    });
    const playerOwnership = worldDb.listRelationships({ entityId: 'player', direction: 'out', type: 'ownership' })
      .find((relationship) => relationship.targetEntityId === 'item_ash_tonic') || null;
    const elenaOwnership = worldDb.listRelationships({ entityId: 'character_elena', direction: 'out', type: 'ownership' })
      .find((relationship) => relationship.targetEntityId === 'item_ash_tonic') || null;
    const playerInventoryComponent = worldDb.getComponent('player', 'inventory');
    const elenaInventoryComponent = worldDb.getComponent('character_elena', 'inventory');
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ transferred, playerOwnership, elenaOwnership, playerInventoryComponent, elenaInventoryComponent }));
  `);

  assert.equal(result.transferred.result.type, 'item.transferred');
  assert.equal(result.transferred.result.facts.quantity, 2);
  assert.equal(result.playerOwnership, null);
  assert.equal(result.elenaOwnership.data.quantity, 2);
  assert.ok(!result.playerInventoryComponent.items.includes('item_ash_tonic'));
  assert.ok(result.elenaInventoryComponent.items.includes('item_ash_tonic'));
});

test('weapon attacks reject a weapon that is no longer owned', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    const worldActions = await import(${JSON.stringify(WORLD_ACTIONS_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    inventoryApi.ensureInventoryConsistency();
    const availableBefore = worldActions.listWorldActions({ actorId: 'player', targetId: 'character_elena' }).actions;
    const transferred = inventoryApi.executeInventoryAction({
      kind: 'item.transfer',
      itemId: 'item_iron_sword',
      targetId: 'character_elena',
    });
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
    console.log(JSON.stringify({ availableBefore, transferred, error }));
  `);

  assert.equal(result.availableBefore[0]?.kind, 'attack.weapon');
  assert.ok(!result.transferred.inventory.items.some((item) => item.id === 'item_iron_sword'));
  assert.match(result.error, /不能执行/);
});

test('weapon attacks accept mechanically classified owned weapons', () => {
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

test('multiple owned weapons produce separate attack choices and require an explicit weapon', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const inventoryApi = await import(${JSON.stringify(INVENTORY_MODULE_URL)});
    const worldActions = await import(${JSON.stringify(WORLD_ACTIONS_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    inventoryApi.ensureInventoryConsistency();
    worldDb.upsertEntity('item_test_spear', 'item', '测试长矛');
    worldDb.upsertComponent('item_test_spear', 'identity', { role: 'weapon', damageDice: '1d6', damageType: 'piercing' });
    worldDb.upsertComponent('item_test_spear', 'item', { category: 'weapon', droppable: true });
    worldDb.upsertRelationship('player', 'item_test_spear', 'ownership', null, { quantity: 1 });
    const actions = worldActions.listWorldActions({ actorId: 'player', targetId: 'character_elena' }).actions;
    let ambiguousError = '';
    try {
      worldActions.executeWorldAction({ kind: 'attack.weapon', actorId: 'player', targetId: 'character_elena' });
    } catch (caught) {
      ambiguousError = caught instanceof Error ? caught.message : String(caught);
    }
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ actions, ambiguousError }));
  `);

  assert.deepEqual(result.actions.map((action) => action.weaponId).sort(), ['item_iron_sword', 'item_test_spear']);
  assert.match(result.ambiguousError, /不能执行/);
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

test('generic world patches cannot bypass inventory ownership actions', () => {
  const result = runIsolatedInventoryScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(WORLD_AGENT_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    const patched = worldAgent.executeWorldTool('apply_world_patch', {
      operations: [{
        op: 'set_relationship',
        sourceEntityId: 'character_elena',
        targetEntityId: 'item_iron_sword',
        relationshipType: 'ownership',
        data: { quantity: 1 },
      }],
      confirmedTargetIds: ['character_elena', 'item_iron_sword'],
    });
    const playerStillOwnsSword = worldDb.listRelationships({ entityId: 'player', direction: 'out', type: 'ownership' })
      .some((relationship) => relationship.targetEntityId === 'item_iron_sword');
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ patched, playerStillOwnsSword }));
  `);

  assert.equal(result.patched.ok, false);
  assert.match(result.patched.error, /execute_item_action|所有权/);
  assert.equal(result.playerStillOwnsSword, true);
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
