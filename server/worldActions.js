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

const WORLD_ATTACK_KINDS = new Set(['attack.weapon', 'attack.unarmed']);

export function listWorldActions({
  actorId = 'player',
  targetId = '',
  includeUnarmed = false,
} = {}) {
  return {
    actions: [
      ...getWeaponAttackActions({ actorId, targetId }),
      ...(includeUnarmed ? getUnarmedAttackActions({ actorId, targetId }) : []),
    ],
  };
}

export function executeWorldAction(input = {}) {
  const requestedKind = String(input.kind || input.actionKind || '');
  const actionId = String(input.actionId || input.id || '');
  const kind = requestedKind
    || (actionId.startsWith('attack.unarmed:') ? 'attack.unarmed' : '')
    || 'attack.weapon';
  if (!WORLD_ATTACK_KINDS.has(kind)) {
    throw new Error(`未知动作类型：${kind}`);
  }
  if (actionId && !actionId.startsWith(`${kind}:`)) {
    throw new Error(`未知动作：${actionId}`);
  }

  const actorId = String(input.actorId || 'player');
  const targetId = String(input.targetId || '');
  const weaponId = String(input.weaponId || '');
  const action = kind === 'attack.unarmed'
    ? getUnarmedAttackAction({ actorId, targetId })
    : getWeaponAttackAction({ actorId, targetId, weaponId });
  if (!action) {
    throw new Error('当前状态下不能执行这个攻击动作。');
  }

  return resolveAttack(action);
}

function getWeaponAttackAction({ actorId = 'player', targetId = '', weaponId = '' } = {}) {
  const context = getWeaponAttackContext(actorId, targetId);
  if (!context) return null;
  const ownedWeapons = listOwnedWeapons(actorId);
  const weapon = weaponId
    ? ownedWeapons.find((candidate) => candidate.id === weaponId)
    : ownedWeapons.length === 1
      ? ownedWeapons[0]
      : null;
  if (!weapon) return null;
  return createWeaponAttackAction(context, weapon);
}

function getWeaponAttackActions({ actorId = 'player', targetId = '' } = {}) {
  const context = getWeaponAttackContext(actorId, targetId);
  if (!context) return [];
  return listOwnedWeapons(actorId).map((weapon) => createWeaponAttackAction(context, weapon));
}

function getUnarmedAttackAction({ actorId = 'player', targetId = '' } = {}) {
  const context = getWeaponAttackContext(actorId, targetId);
  return context ? createUnarmedAttackAction(context) : null;
}

function getUnarmedAttackActions({ actorId = 'player', targetId = '' } = {}) {
  const action = getUnarmedAttackAction({ actorId, targetId });
  return action ? [action] : [];
}

function getWeaponAttackContext(actorId, targetId) {
  const actor = getEntity(actorId);
  const target = getEntity(targetId);
  if (
    !actor
    || !target
    || !['character', 'player'].includes(actor.kind)
    || !['character', 'player'].includes(target.kind)
  ) return null;
  if (!isEntityInCurrentScene(targetId) || !isEntityInCurrentScene(actorId)) return null;

  const actorStatus = getComponent(actorId, 'status') || {};
  const actorStats = getComponent(actorId, 'stats') || {};
  if (actorStatus.canAct === false || Number(actorStats.currentHitPoints ?? 1) <= 0) return null;

  const targetStatus = getComponent(targetId, 'status') || {};
  const targetStats = getComponent(targetId, 'stats') || {};
  if (targetStatus.canAct === false || Number(targetStats.currentHitPoints ?? 1) <= 0) return null;

  return { actor, actorId, target, targetId };
}

function listOwnedWeapons(actorId) {
  return listRelationships({ entityId: actorId, direction: 'out', type: 'ownership' })
    .map((relationship) => getEntity(relationship.targetEntityId))
    .filter((entity) => entity?.kind === 'item' && isWeaponItem(entity.id));
}

function isWeaponItem(itemId) {
  const identity = getComponent(itemId, 'identity') || {};
  const rules = getComponent(itemId, 'item') || {};
  return identity.role === 'weapon' || rules.category === 'weapon' || rules.equipSlot === 'weapon';
}

function createWeaponAttackAction({ actor, actorId, target, targetId }, weapon) {
  const weaponName = weapon.name || weapon.id;
  const actorStats = getComponent(actorId, 'stats') || {};
  const weaponIdentity = getComponent(weapon.id, 'identity') || {};
  const ability = String(weaponIdentity.attackAbility || 'strength');
  const abilityMod = numberValue(actorStats[`${ability}Mod`], 0);
  const proficiencyBonus = weaponIdentity.proficient === false ? 0 : numberValue(actorStats.proficiencyBonus, 0);
  return {
    id: `attack.weapon:${actorId}:${targetId}:${weapon.id}`,
    kind: 'attack.weapon',
    label: `使用${weaponName}攻击`,
    actorId,
    actorName: actor.name,
    targetId,
    targetName: target.name,
    weaponId: weapon.id,
    weaponName,
    attackName: weaponName,
    attackBonus: abilityMod + proficiencyBonus,
    damageDice: String(weaponIdentity.damageDice || '1d4'),
    damageBonus: abilityMod,
    damageType: String(weaponIdentity.damageType || 'weapon'),
  };
}

function createUnarmedAttackAction({ actor, actorId, target, targetId }) {
  const actorStats = getComponent(actorId, 'stats') || {};
  const actorIdentity = getComponent(actorId, 'identity') || {};
  const attackName = firstNonEmptyString(
    actorStats.unarmedAttackName,
    actorIdentity.unarmedAttackName,
    actorStats.naturalAttackName,
    actorIdentity.naturalAttackName,
    '徒手',
  );
  const ability = firstNonEmptyString(
    actorStats.unarmedAttackAbility,
    actorIdentity.unarmedAttackAbility,
    actorStats.naturalAttackAbility,
    actorIdentity.naturalAttackAbility,
    'strength',
  );
  const abilityMod = numberValue(actorStats[`${ability}Mod`], 0);
  const proficiencyBonus = readBoolean(
    actorStats.unarmedProficient,
    actorIdentity.unarmedProficient,
    actorStats.naturalAttackProficient,
    actorIdentity.naturalAttackProficient,
  ) === false
    ? 0
    : numberValue(actorStats.proficiencyBonus, 0);
  const attackBonus = firstFiniteNumber(
    actorStats.unarmedAttackBonus,
    actorIdentity.unarmedAttackBonus,
    actorStats.naturalAttackBonus,
    actorIdentity.naturalAttackBonus,
  ) ?? abilityMod + proficiencyBonus;
  const damageBonus = firstFiniteNumber(
    actorStats.unarmedDamageBonus,
    actorIdentity.unarmedDamageBonus,
    actorStats.naturalAttackDamageBonus,
    actorIdentity.naturalAttackDamageBonus,
  ) ?? abilityMod;

  return {
    id: `attack.unarmed:${actorId}:${targetId}`,
    kind: 'attack.unarmed',
    label: `使用${attackName}攻击`,
    actorId,
    actorName: actor.name,
    targetId,
    targetName: target.name,
    attackName,
    attackBonus,
    damageDice: firstNonEmptyString(
      actorStats.unarmedDamageDice,
      actorIdentity.unarmedDamageDice,
      actorStats.naturalAttackDamageDice,
      actorIdentity.naturalAttackDamageDice,
      '1d2',
    ),
    damageBonus,
    damageType: firstNonEmptyString(
      actorStats.unarmedDamageType,
      actorIdentity.unarmedDamageType,
      actorStats.naturalAttackDamageType,
      actorIdentity.naturalAttackDamageType,
      'bludgeoning',
    ),
  };
}

function resolveAttack(action) {
  return withTransaction(() => {
    const targetStats = getComponent(action.targetId, 'stats') || {};
    const targetStatusBefore = getComponent(action.targetId, 'status') || null;
    const attackBonus = numberValue(action.attackBonus, 0);
    const targetArmorClass = numberValue(targetStats.armorClass, numberValue(targetStats.ac, 10));
    const attackDie = rollDie(20);
    const attackTotal = attackDie + attackBonus;
    const critical = attackDie === 20;
    const naturalOne = attackDie === 1;
    const hit = critical || (!naturalOne && attackTotal >= targetArmorClass);

    const damageDice = String(action.damageDice || '1d2');
    const damageBonus = numberValue(action.damageBonus, 0);
    const damageType = String(action.damageType || 'bludgeoning');
    const damageRoll = hit ? rollDiceExpression(damageDice, critical ? 2 : 1) : null;
    const damage = hit ? Math.max(0, damageRoll.total + damageBonus) : 0;
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
        incapacitatedReason: 'zero_hit_points',
        statusBeforeIncapacitation: targetStatusBefore,
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
      ? `${action.actorName}使用${action.attackName}攻击${action.targetName}，命中，造成 ${damage} 点${formatDamageType(damageType)}伤害。${action.targetName} HP 从 ${hpBefore} 降到 ${hpAfter}。`
      : `${action.actorName}使用${action.attackName}攻击${action.targetName}，攻击检定 ${attackTotal} 未命中。`;

    const result = {
      type: 'attack.resolved',
      action,
      facts: {
        actor: { id: action.actorId, name: action.actorName },
        target: { id: action.targetId, name: action.targetName },
        attack: { kind: action.kind, name: action.attackName },
        ...(action.kind === 'attack.weapon'
          ? { weapon: { id: action.weaponId, name: action.weaponName } }
          : {}),
        attackRoll: {
          expression: formatRollExpression('1d20', attackBonus),
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
              expression: `${critical ? '2x' : ''}${formatRollExpression(damageDice, damageBonus)}`,
              dice: damageRoll.dice,
              subtotal: damageRoll.total,
              bonus: damageBonus,
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

function firstFiniteNumber(...values) {
  for (const value of values) {
    if (
      value === null
      || value === undefined
      || (typeof value === 'string' && !value.trim())
    ) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function readBoolean(...values) {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
  }
  return null;
}

function formatRollExpression(dice, bonus) {
  if (!bonus) return dice;
  return `${dice}${bonus > 0 ? '+' : ''}${bonus}`;
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
  if (critical) return [`${action.attackName}结结实实命中${action.targetName}。`, `${action.targetName}仍然能够行动。`];
  return [`${action.targetName}受到 ${damage} 点伤害。`, `${action.targetName}仍然能够行动。`];
}
