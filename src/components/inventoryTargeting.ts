import type {
  AttackWorldAction,
  InventoryItem,
  InventoryTarget,
  ItemTargetingAction,
  PlayerInventory,
  WeaponAttackTargetingAction,
  WorldAction,
} from '../types';

export function createWeaponAttackTargetingAction(
  inventory: PlayerInventory | null,
  item: InventoryItem,
): WeaponAttackTargetingAction | null {
  if (
    !inventory
    || !item.equipped
    || inventory.equippedWeaponId !== item.id
    || (item.category !== 'weapon' && item.rules.equipSlot !== 'weapon')
  ) return null;

  const validTargetIds = inventory.targets
    .filter((target) => isAttackableNpc(target, inventory.actor.id))
    .map((target) => target.id);
  const actor = inventory.targets.find((target) => target.id === inventory.actor.id);
  const actorCannotAttack = !actor
    || actor.vitalState !== 'active'
    || Boolean(actor.health && actor.health.currentHitPoints <= 0);

  return {
    id: `attack.weapon:${inventory.actor.id}:${item.id}`,
    kind: 'attack.weapon',
    label: '攻击',
    actorId: inventory.actor.id,
    weaponId: item.id,
    weaponName: item.name,
    targetMode: 'character',
    requiresTarget: true,
    validTargetIds,
    disabledReason: actorCannotAttack
      ? '当前状态无法发动攻击。'
      : validTargetIds.length
        ? null
        : '当前场景没有可攻击的 NPC 目标。',
    danger: true,
  };
}

export function refreshItemTargetingAction(
  inventory: PlayerInventory | null,
  itemId: string,
  action: ItemTargetingAction,
): ItemTargetingAction | null {
  if (!inventory) return null;
  const item = inventory.items.find((candidate) => candidate.id === itemId);
  if (!item) return null;
  if (action.kind === 'attack.weapon') {
    return createWeaponAttackTargetingAction(inventory, item);
  }
  return item.actions.find((candidate) => candidate.id === action.id) || null;
}

export function createWorldActionForTarget(
  inventory: PlayerInventory | null,
  action: ItemTargetingAction,
  targetId: string,
): WorldAction | null {
  if (!inventory || !action.validTargetIds.includes(targetId)) return null;
  if (action.kind !== 'attack.weapon') return { ...action, targetId };

  const target = inventory.targets.find((candidate) => candidate.id === targetId);
  if (!target || !isAttackableNpc(target, action.actorId)) return null;
  const attackAction: AttackWorldAction = {
    id: `attack.weapon:${action.actorId}:${targetId}:${action.weaponId}`,
    kind: 'attack.weapon',
    label: `使用${action.weaponName}攻击`,
    actorId: action.actorId,
    targetId,
    targetName: target.name,
    weaponId: action.weaponId,
    weaponName: action.weaponName,
  };
  return attackAction;
}

function isAttackableNpc(target: InventoryTarget, actorId: string) {
  return target.id !== actorId
    && target.kind === 'character'
    && target.vitalState === 'active'
    && (!target.health || target.health.currentHitPoints > 0);
}
