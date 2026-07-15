import {
  addEvent,
  getComponent,
  getCurrentLocationId,
  getCurrentScene,
  getEntity,
  getMeta,
  getWorldOverview,
  listRelationships,
  upsertComponent,
  withTransaction,
} from './worldDb.js';

export function listWorldActions({ actorId = 'player', targetId = '' } = {}) {
  const action = getWeaponAttackAction({ actorId, targetId });
  return {
    actions: action ? [action] : [],
  };
}

export function executeWorldAction(input = {}) {
  const kind = String(input.kind || input.actionKind || '');
  const actionId = String(input.actionId || input.id || '');
  if (kind && kind !== 'attack.weapon') {
    throw new Error(`未知动作类型：${kind}`);
  }
  if (actionId && !actionId.startsWith('attack.weapon:')) {
    throw new Error(`未知动作：${actionId}`);
  }

  const actorId = String(input.actorId || 'player');
  const targetId = String(input.targetId || '');
  const weaponId = String(input.weaponId || '');
  const action = getWeaponAttackAction({ actorId, targetId, weaponId });
  if (!action) {
    throw new Error('当前状态下不能执行这个攻击动作。');
  }

  return resolveWeaponAttack(action);
}

function getWeaponAttackAction({ actorId = 'player', targetId = '', weaponId = '' } = {}) {
  const actor = getEntity(actorId);
  const target = getEntity(targetId);
  if (!actor || !target || target.kind !== 'character') return null;
  if (!isEntityInCurrentScene(targetId) || !isEntityInCurrentScene(actorId)) return null;

  const actorStatus = getComponent(actorId, 'status') || {};
  const actorStats = getComponent(actorId, 'stats') || {};
  if (actorStatus.canAct === false || Number(actorStats.currentHitPoints ?? 1) <= 0) return null;

  const targetStatus = getComponent(targetId, 'status') || {};
  const targetStats = getComponent(targetId, 'stats') || {};
  if (targetStatus.canAct === false || Number(targetStats.currentHitPoints ?? 1) <= 0) return null;

  const inventory = getComponent(actorId, 'inventory') || {};
  const equippedWeaponId = String(inventory.equippedWeaponId || '');
  if (weaponId && weaponId !== equippedWeaponId) return null;
  if (!equippedWeaponId || !ownsItem(actorId, equippedWeaponId)) return null;

  const weapon = getEntity(equippedWeaponId);
  const weaponIdentity = getComponent(equippedWeaponId, 'identity') || {};
  const weaponRules = getComponent(equippedWeaponId, 'item') || {};
  const isWeapon = weaponIdentity.role === 'weapon'
    || weaponRules.category === 'weapon'
    || weaponRules.equipSlot === 'weapon';
  if (!weapon || weapon.kind !== 'item' || !isWeapon) return null;

  const weaponName = weapon.name || equippedWeaponId;
  return {
    id: `attack.weapon:${actorId}:${targetId}:${equippedWeaponId}`,
    kind: 'attack.weapon',
    label: `使用${weaponName}攻击`,
    actorId,
    actorName: actor.name,
    targetId,
    targetName: target.name,
    weaponId: equippedWeaponId,
    weaponName,
  };
}

function resolveWeaponAttack(action) {
  return withTransaction(() => {
    const actorStats = getComponent(action.actorId, 'stats') || {};
    const targetStats = getComponent(action.targetId, 'stats') || {};
    const targetStatusBefore = getComponent(action.targetId, 'status') || null;
    const weaponIdentity = getComponent(action.weaponId, 'identity') || {};
    const ability = String(weaponIdentity.attackAbility || 'strength');
    const abilityMod = numberValue(actorStats[`${ability}Mod`], 0);
    const proficiencyBonus = weaponIdentity.proficient === false ? 0 : numberValue(actorStats.proficiencyBonus, 0);
    const attackBonus = abilityMod + proficiencyBonus;
    const targetArmorClass = numberValue(targetStats.armorClass, numberValue(targetStats.ac, 10));
    const attackDie = rollDie(20);
    const attackTotal = attackDie + attackBonus;
    const critical = attackDie === 20;
    const naturalOne = attackDie === 1;
    const hit = critical || (!naturalOne && attackTotal >= targetArmorClass);

    const damageDice = String(weaponIdentity.damageDice || '1d4');
    const damageType = String(weaponIdentity.damageType || 'weapon');
    const damageRoll = hit ? rollDiceExpression(damageDice, critical ? 2 : 1) : null;
    const damage = hit ? Math.max(0, damageRoll.total + abilityMod) : 0;
    const hpBefore = Math.max(0, numberValue(targetStats.currentHitPoints, numberValue(targetStats.maxHitPoints, 0)));
    const hpAfter = hit ? Math.max(0, hpBefore - damage) : hpBefore;
    const targetStatsAfter = hit ? { ...targetStats, currentHitPoints: hpAfter } : targetStats;
    const stateChanges = [];

    if (hit) {
      upsertComponent(action.targetId, 'stats', targetStatsAfter);
      stateChanges.push({
        entityId: action.targetId,
        componentType: 'stats',
        path: 'currentHitPoints',
        from: hpBefore,
        to: hpAfter,
      });
    }

    if (hit && hpAfter <= 0) {
      const nextStatus = {
        ...(targetStatusBefore || {}),
        state: 'incapacitated',
        label: '失能',
        description: `${action.targetName} 因伤势倒下，暂时无法行动。`,
        canAct: false,
      };
      upsertComponent(action.targetId, 'status', nextStatus);
      stateChanges.push({
        entityId: action.targetId,
        componentType: 'status',
        path: '',
        from: targetStatusBefore,
        to: nextStatus,
      });
    }

    const summary = hit
      ? `${action.actorName}使用${action.weaponName}攻击${action.targetName}，命中，造成 ${damage} 点${formatDamageType(damageType)}伤害。${action.targetName} HP 从 ${hpBefore} 降到 ${hpAfter}。`
      : `${action.actorName}使用${action.weaponName}攻击${action.targetName}，攻击检定 ${attackTotal} 未命中。`;

    const result = {
      type: 'attack.resolved',
      action,
      facts: {
        actor: { id: action.actorId, name: action.actorName },
        target: { id: action.targetId, name: action.targetName },
        weapon: { id: action.weaponId, name: action.weaponName },
        attackRoll: {
          expression: `1d20+${attackBonus}`,
          die: attackDie,
          bonus: attackBonus,
          total: attackTotal,
          targetArmorClass,
        },
        hit,
        critical,
        naturalOne,
        damageRoll: damageRoll
          ? {
              expression: `${critical ? '2x' : ''}${damageDice}+${abilityMod}`,
              dice: damageRoll.dice,
              subtotal: damageRoll.total,
              bonus: abilityMod,
              total: damage,
              damageType,
            }
          : null,
        damage,
        hpBefore,
        hpAfter,
      },
      stateChanges,
      narrationHints: {
        tone: hpAfter <= 0 ? 'decisive' : hit ? 'tense' : 'near miss',
        visibleEffects: createVisibleEffects({ action, hit, critical, damage, hpAfter }),
        targetCanAct: hpAfter > 0,
      },
      summary,
    };

    const event = addEvent('attack.resolved', action.actorId, action.targetId, result);
    return {
      ok: true,
      eventId: event.id,
      result,
      world: getWorldOverview(),
    };
  });
}

function isEntityInCurrentScene(entityId) {
  const currentScene = getCurrentScene();
  const sceneId = currentScene.scene?.id;
  if (!sceneId) return false;
  if (entityId === getMeta('playerId', 'player')) return getCurrentLocationId(entityId) === sceneId;
  return getCurrentLocationId(entityId) === sceneId;
}

function ownsItem(actorId, itemId) {
  return listRelationships({ entityId: actorId, direction: 'out', type: 'ownership' }).some(
    (relationship) => relationship.targetEntityId === itemId,
  );
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function rollDiceExpression(expression, multiplier = 1) {
  const match = String(expression || '').trim().match(/^(\d*)d(\d+)$/i);
  if (!match) throw new Error(`暂不支持的伤害骰表达式：${expression}`);
  const count = Math.max(1, Number(match[1] || 1)) * Math.max(1, multiplier);
  const sides = Number(match[2]);
  if (!Number.isInteger(sides) || sides < 2 || sides > 100) {
    throw new Error(`暂不支持的伤害骰面数：${expression}`);
  }
  const dice = Array.from({ length: count }, () => rollDie(sides));
  return {
    dice,
    total: dice.reduce((sum, value) => sum + value, 0),
  };
}

function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatDamageType(type) {
  if (type === 'slashing') return '挥砍';
  if (type === 'piercing') return '穿刺';
  if (type === 'bludgeoning') return '钝击';
  return type ? `${type} ` : '';
}

function createVisibleEffects({ action, hit, critical, damage, hpAfter }) {
  if (!hit) return [`${action.targetName}避开了这次攻击。`];
  if (hpAfter <= 0) return [`${action.targetName}受到 ${damage} 点伤害并倒下。`];
  if (critical) return [`${action.weaponName}结结实实命中${action.targetName}。`, `${action.targetName}仍然能够行动。`];
  return [`${action.targetName}受到 ${damage} 点伤害。`, `${action.targetName}仍然能够行动。`];
}
