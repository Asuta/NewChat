import assert from 'node:assert/strict';
import test from 'node:test';
import type { InventoryItem, PlayerInventory } from '../types';
import {
  createWeaponAttackTargetingAction,
  createWorldActionForTarget,
  refreshItemTargetingAction,
} from './inventoryTargeting';

const sword: InventoryItem = {
  id: 'item_sword',
  name: '测试铁剑',
  quantity: 1,
  category: 'weapon',
  identity: { role: 'weapon' },
  rules: { category: 'weapon', stackable: false, droppable: true, equipSlot: null, use: null },
  actions: [],
};

const inventory: PlayerInventory = {
  actor: { id: 'player', name: '玩家' },
  gold: 0,
  totalQuantity: 1,
  items: [sword],
  nearbyItems: [],
  targets: [
    { id: 'player', name: '玩家', kind: 'character', vitalState: 'active', health: { currentHitPoints: 10, maxHitPoints: 10 } },
    { id: 'npc_active', name: '可攻击 NPC', kind: 'character', vitalState: 'active', health: { currentHitPoints: 8, maxHitPoints: 10 } },
    { id: 'npc_down', name: '失能 NPC', kind: 'character', vitalState: 'incapacitated', health: { currentHitPoints: 0, maxHitPoints: 10 } },
    { id: 'item_target', name: '场景道具', kind: 'item', vitalState: 'active', health: null },
  ],
};

test('owned weapon exposes attack targeting for active NPCs only', () => {
  const action = createWeaponAttackTargetingAction(inventory, sword);

  assert.ok(action);
  assert.deepEqual(action.validTargetIds, ['npc_active']);
  assert.equal(action.danger, true);
  assert.equal(action.disabledReason, null);
});

test('weapon attack targeting disappears as soon as ownership changes', () => {
  const action = createWeaponAttackTargetingAction(inventory, sword);
  assert.ok(action);

  const transferredInventory = {
    ...inventory,
    totalQuantity: 0,
    items: [],
    nearbyItems: [sword],
  };
  assert.equal(refreshItemTargetingAction(transferredInventory, sword.id, action), null);
  assert.equal(createWeaponAttackTargetingAction(transferredInventory, sword), null);
});

test('weapon attack targeting is disabled while the actor cannot act', () => {
  const incapacitatedInventory = {
    ...inventory,
    targets: inventory.targets.map((target) => target.id === inventory.actor.id
      ? {
          ...target,
          vitalState: 'incapacitated' as const,
          health: { currentHitPoints: 0, maxHitPoints: 10 },
        }
      : target),
  };

  const action = createWeaponAttackTargetingAction(incapacitatedInventory, sword);
  assert.ok(action);
  assert.equal(action.disabledReason, '当前状态无法发动攻击。');
});

test('mechanically classified weapons do not require the legacy weapon role', () => {
  const mechanicalWeapon = {
    ...sword,
    identity: { ...sword.identity, role: 'relic' },
  };
  const mechanicalInventory = {
    ...inventory,
    items: [mechanicalWeapon],
  };

  const action = createWeaponAttackTargetingAction(mechanicalInventory, mechanicalWeapon);
  assert.ok(action);
  assert.equal(action.disabledReason, null);
});

test('targeting resolves to the existing authoritative weapon attack action shape', () => {
  const action = createWeaponAttackTargetingAction(inventory, sword);
  assert.ok(action);

  const resolved = createWorldActionForTarget(inventory, action, 'npc_active');
  assert.ok(resolved && resolved.kind === 'attack.weapon');
  assert.equal(resolved.targetName, '可攻击 NPC');
  assert.equal(resolved.weaponId, sword.id);
  assert.equal(createWorldActionForTarget(inventory, action, 'npc_down'), null);
});
