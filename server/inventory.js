import {
  addEvent,
  deleteRelationship,
  getComponent,
  getCurrentLocationId,
  getCurrentScene,
  getEntity,
  getWorldOverview,
  listRelationships,
  setCurrentLocation,
  upsertComponent,
  upsertRelationship,
  withTransaction,
} from './worldDb.js';

const INVENTORY_ACTION_KINDS = new Set([
  'item.equip',
  'item.unequip',
  'item.use',
  'item.present',
  'item.drop',
  'item.pickup',
]);

export function ensureInventoryConsistency(actorId = 'player') {
  const actor = getEntity(actorId);
  if (!actor) return;

  withTransaction(() => {
    const inventory = getComponent(actorId, 'inventory') || {};
    const legacyItemIds = Array.isArray(inventory.items) ? inventory.items : [];
    const ownedRelationships = listRelationships({ entityId: actorId, direction: 'out', type: 'ownership' });
    const ownedItemIds = new Set(
      ownedRelationships
        .filter((relationship) => getEntity(relationship.targetEntityId)?.kind === 'item')
        .map((relationship) => relationship.targetEntityId),
    );

    for (const itemId of legacyItemIds) {
      const item = getEntity(itemId);
      if (!item || item.kind !== 'item' || ownedItemIds.has(itemId)) continue;
      upsertRelationship(actorId, itemId, 'ownership', null, {
        source: 'inventory.migration',
        summary: `${actor.name}持有${item.name}。`,
        quantity: 1,
      });
      ownedItemIds.add(itemId);
    }

    for (const relationship of listRelationships({ entityId: actorId, direction: 'out', type: 'ownership' })) {
      if (getEntity(relationship.targetEntityId)?.kind !== 'item') continue;
      const quantity = normalizeQuantity(relationship.data?.quantity);
      if (relationship.data?.quantity === quantity) continue;
      upsertRelationship(actorId, relationship.targetEntityId, 'ownership', relationship.value, {
        ...relationship.data,
        quantity,
      });
    }

    syncLegacyInventoryMirror(actorId);
  });
}

export function getInventory(actorId = 'player') {
  const actor = getEntity(actorId);
  if (!actor) throw new Error(`背包持有者 ${actorId} 不存在。`);

  const inventory = getComponent(actorId, 'inventory') || {};
  const scene = getInventoryScene(actorId);
  const targets = buildInventoryTargets(actorId, scene);
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const ownedRelationships = listRelationships({ entityId: actorId, direction: 'out', type: 'ownership' });
  const items = ownedRelationships
    .map((relationship) => buildOwnedInventoryItem(actorId, relationship, inventory, targetById))
    .filter(Boolean)
    .sort(compareInventoryItems);

  const locationRelationships = new Map(
    listRelationships({ entityId: scene.scene.id, direction: 'in', type: 'located_in' })
      .map((relationship) => [relationship.sourceEntityId, relationship]),
  );
  const nearbyItems = (scene.items || [])
    .filter((entity) => entity.id !== actorId && !ownedRelationships.some((relationship) => relationship.targetEntityId === entity.id))
    .map((entity) => buildNearbyInventoryItem(actorId, entity, locationRelationships.get(entity.id)))
    .sort(compareInventoryItems);

  return {
    actor: { id: actor.id, name: actor.name },
    gold: finiteNumber(inventory.gold, 0),
    equippedWeaponId: typeof inventory.equippedWeaponId === 'string' ? inventory.equippedWeaponId : null,
    totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
    items,
    nearbyItems,
    targets,
  };
}

export function executeInventoryAction(input = {}) {
  const kind = String(input.kind || input.actionKind || '').trim();
  if (!INVENTORY_ACTION_KINDS.has(kind)) {
    throw new Error(`未知背包动作：${kind || '未提供'}`);
  }

  const actorId = String(input.actorId || 'player').trim() || 'player';
  const itemId = String(input.itemId || '').trim();
  const targetId = String(input.targetId || '').trim();
  if (!itemId) throw new Error('背包动作缺少 itemId。');

  return withTransaction(() => {
    const before = getInventory(actorId);
    const item = kind === 'item.pickup'
      ? before.nearbyItems.find((candidate) => candidate.id === itemId)
      : before.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      throw new Error(kind === 'item.pickup' ? '这个道具已经不在当前场景。' : '你已经不再持有这个道具。');
    }

    const action = item.actions.find((candidate) => candidate.kind === kind);
    if (!action) throw new Error('这个道具不支持该动作。');
    if (action.disabledReason) throw new Error(action.disabledReason);
    if (action.requiresTarget && !targetId) throw new Error('请先选择道具使用目标。');
    if (targetId && !action.validTargetIds?.includes(targetId)) {
      throw new Error('所选目标当前不能接受这个道具。');
    }

    const resolved = resolveInventoryAction({ kind, actorId, itemId, targetId, item, before });
    const event = addEvent(resolved.eventType, actorId, targetId || itemId, resolved.result);
    return {
      ok: true,
      eventId: event.id,
      result: resolved.result,
      world: getWorldOverview(),
      inventory: getInventory(actorId),
    };
  });
}

function resolveInventoryAction({ kind, actorId, itemId, targetId, item, before }) {
  const actor = getEntity(actorId);
  const entity = getEntity(itemId);
  if (!actor || !entity) throw new Error('动作涉及的实体不存在。');

  if (kind === 'item.equip') {
    const inventory = getComponent(actorId, 'inventory') || {};
    const previousWeaponId = typeof inventory.equippedWeaponId === 'string' ? inventory.equippedWeaponId : null;
    upsertComponent(actorId, 'inventory', { ...inventory, equippedWeaponId: itemId });
    const summary = `${actor.name}装备了${entity.name}。`;
    return createResolvedAction({
      eventType: 'item.equipped', kind, actorId, itemId, targetId: actorId, itemName: entity.name, summary,
      facts: { previousWeaponId, equippedWeaponId: itemId },
      stateChanges: [{ entityId: actorId, componentType: 'inventory', path: 'equippedWeaponId', from: previousWeaponId, to: itemId }],
    });
  }

  if (kind === 'item.unequip') {
    const inventory = getComponent(actorId, 'inventory') || {};
    const previousWeaponId = typeof inventory.equippedWeaponId === 'string' ? inventory.equippedWeaponId : null;
    const nextInventory = { ...inventory };
    delete nextInventory.equippedWeaponId;
    upsertComponent(actorId, 'inventory', nextInventory);
    const summary = `${actor.name}卸下了${entity.name}。`;
    return createResolvedAction({
      eventType: 'item.unequipped', kind, actorId, itemId, targetId: actorId, itemName: entity.name, summary,
      facts: { previousWeaponId, equippedWeaponId: null },
      stateChanges: [{ entityId: actorId, componentType: 'inventory', path: 'equippedWeaponId', from: previousWeaponId, to: null }],
    });
  }

  if (kind === 'item.use') {
    const target = getEntity(targetId);
    if (!target) throw new Error('道具使用目标不存在。');
    const statsBefore = getComponent(targetId, 'stats') || {};
    const hpBefore = Math.max(0, finiteNumber(statsBefore.currentHitPoints, 0));
    const maxHitPoints = Math.max(hpBefore, finiteNumber(statsBefore.maxHitPoints, hpBefore));
    const amount = Math.max(1, Math.floor(finiteNumber(item.rules.use?.amount, 1)));
    const hpAfter = Math.min(maxHitPoints, hpBefore + amount);
    const restoredHitPoints = hpAfter - hpBefore;
    if (restoredHitPoints <= 0) throw new Error(`${target.name}当前不需要恢复生命值。`);
    upsertComponent(targetId, 'stats', { ...statsBefore, currentHitPoints: hpAfter });
    const quantityAfter = consumeOwnedQuantity(actorId, itemId, item.rules.use?.consumeQuantity);
    syncLegacyInventoryMirror(actorId);
    const summary = `${actor.name}对${target.name}使用${entity.name}，恢复 ${restoredHitPoints} 点生命值。`;
    return createResolvedAction({
      eventType: 'item.used', kind, actorId, itemId, targetId, itemName: entity.name, summary,
      facts: { target: { id: target.id, name: target.name }, hpBefore, hpAfter, maxHitPoints, restoredHitPoints, quantityAfter },
      stateChanges: [
        { entityId: targetId, componentType: 'stats', path: 'currentHitPoints', from: hpBefore, to: hpAfter },
        { entityId: actorId, relationshipType: 'ownership', targetEntityId: itemId, path: 'quantity', from: item.quantity, to: quantityAfter },
      ],
    });
  }

  if (kind === 'item.present') {
    const target = targetId ? getEntity(targetId) : null;
    const summary = target
      ? `${actor.name}向${target.name}展示了${entity.name}。`
      : `${actor.name}拿出了${entity.name}，尝试让它在当前情境中发挥作用。`;
    return createResolvedAction({
      eventType: 'item.presented', kind, actorId, itemId, targetId: targetId || null, itemName: entity.name, summary,
      facts: { target: target ? { id: target.id, name: target.name } : null, effect: item.identity.effect || null },
      stateChanges: [],
    });
  }

  if (kind === 'item.drop') {
    const sceneId = getInventoryScene(actorId).scene?.id;
    if (!sceneId) throw new Error('当前场景无效，不能丢弃道具。');
    deleteRelationship(actorId, itemId, 'ownership');
    setCurrentLocation(itemId, sceneId, 'inventory.drop', `${actor.name}把${entity.name}留在了当前场景。`);
    const location = listRelationships({ entityId: itemId, direction: 'out', type: 'located_in' })
      .find((relationship) => relationship.targetEntityId === sceneId);
    upsertRelationship(itemId, sceneId, 'located_in', location?.value ?? null, {
      ...location?.data,
      quantity: item.quantity,
    });
    syncLegacyInventoryMirror(actorId);
    const summary = `${actor.name}丢下了${item.quantity > 1 ? `${item.quantity}份` : ''}${entity.name}。`;
    return createResolvedAction({
      eventType: 'item.dropped', kind, actorId, itemId, targetId: sceneId, itemName: entity.name, summary,
      facts: { quantity: item.quantity, sceneId },
      stateChanges: [
        { entityId: actorId, relationshipType: 'ownership', targetEntityId: itemId, from: { quantity: item.quantity }, to: null },
        { entityId: itemId, relationshipType: 'located_in', targetEntityId: sceneId, from: null, to: { sceneId, quantity: item.quantity } },
      ],
    });
  }

  if (kind === 'item.pickup') {
    const sceneId = getInventoryScene(actorId).scene?.id;
    if (!sceneId || getCurrentLocationId(itemId) !== sceneId) throw new Error('这个道具已经不在当前场景。');
    deleteRelationship(itemId, sceneId, 'located_in');
    upsertRelationship(actorId, itemId, 'ownership', null, {
      source: 'inventory.pickup',
      summary: `${actor.name}拾取了${entity.name}。`,
      quantity: item.quantity,
    });
    syncLegacyInventoryMirror(actorId);
    const summary = `${actor.name}拾取了${item.quantity > 1 ? `${item.quantity}件` : ''}${entity.name}。`;
    return createResolvedAction({
      eventType: 'item.picked_up', kind, actorId, itemId, targetId: itemId, itemName: entity.name, summary,
      facts: { quantity: item.quantity, sceneId },
      stateChanges: [
        { entityId: itemId, relationshipType: 'located_in', targetEntityId: sceneId, from: { sceneId, quantity: item.quantity }, to: null },
        { entityId: actorId, relationshipType: 'ownership', targetEntityId: itemId, from: null, to: { quantity: item.quantity } },
      ],
    });
  }

  throw new Error(`尚未实现背包动作：${kind}`);
}

function createResolvedAction({ eventType, kind, actorId, itemId, targetId, itemName, summary, facts, stateChanges }) {
  return {
    eventType,
    result: {
      type: eventType,
      action: { id: `${kind}:${actorId}:${itemId}:${targetId || ''}`, kind, actorId, itemId, targetId: targetId || undefined, itemName },
      facts: {
        actor: { id: actorId, name: getEntity(actorId)?.name || actorId },
        item: { id: itemId, name: itemName },
        ...facts,
      },
      stateChanges,
      narrationHints: { tone: kind === 'item.present' ? 'contextual' : 'grounded', visibleEffects: [summary] },
      summary,
    },
  };
}

function buildOwnedInventoryItem(actorId, relationship, inventory, targetById) {
  const entity = getEntity(relationship.targetEntityId);
  if (!entity || entity.kind !== 'item') return null;
  const identity = getComponent(entity.id, 'identity') || {};
  const rules = normalizeItemRules(identity, getComponent(entity.id, 'item') || {});
  const quantity = normalizeQuantity(relationship.data?.quantity);
  const equipped = inventory.equippedWeaponId === entity.id;
  const actions = [];

  if (rules.equipSlot === 'weapon' || rules.category === 'weapon') {
    actions.push(createItemAction({
      kind: equipped ? 'item.unequip' : 'item.equip',
      label: equipped ? '卸下' : '装备',
      actorId,
      itemId: entity.id,
      targetMode: 'none',
    }));
  }

  if (rules.use?.type === 'restore_hit_points') {
    const validTargetIds = Array.from(targetById.values())
      .filter((target) => target.health && target.health.currentHitPoints < target.health.maxHitPoints && target.vitalState !== 'dead')
      .map((target) => target.id);
    actions.push(createItemAction({
      kind: 'item.use', label: '使用', actorId, itemId: entity.id,
      targetMode: 'self_or_character', requiresTarget: true, validTargetIds,
      disabledReason: validTargetIds.length ? null : '当前场景没有需要恢复生命值的目标。',
    }));
  } else if (rules.use?.type === 'narrative' || ['key_item', 'quest_token', 'clue', 'final_choice_key'].includes(identity.role)) {
    const validTargetIds = Array.from(targetById.values()).filter((target) => target.kind === 'character').map((target) => target.id);
    actions.push(createItemAction({
      kind: 'item.present',
      label: rules.use?.label || (identity.role === 'clue' ? '调查' : '展示'),
      actorId,
      itemId: entity.id,
      targetMode: 'optional_character',
      validTargetIds,
    }));
  }

  actions.push(createItemAction({
    kind: 'item.drop',
    label: quantity > 1 ? '丢弃全部' : '丢弃',
    actorId,
    itemId: entity.id,
    targetMode: 'none',
    disabledReason: rules.droppable === false
      ? '这是与玩家绑定的道具，不能丢弃。'
      : equipped
        ? '请先卸下这件装备。'
        : null,
    danger: true,
  }));

  return {
    id: entity.id,
    name: entity.name,
    quantity,
    equipped,
    category: rules.category,
    identity,
    rules,
    ownership: relationship,
    actions,
  };
}

function buildNearbyInventoryItem(actorId, entity, locationRelationship) {
  const identity = getComponent(entity.id, 'identity') || {};
  const rules = normalizeItemRules(identity, getComponent(entity.id, 'item') || {});
  return {
    id: entity.id,
    name: entity.name,
    quantity: normalizeQuantity(locationRelationship?.data?.quantity),
    equipped: false,
    category: rules.category,
    identity,
    rules,
    actions: [createItemAction({ kind: 'item.pickup', label: '拾取', actorId, itemId: entity.id, targetMode: 'none' })],
  };
}

function getInventoryScene(actorId) {
  const playerScene = getCurrentScene();
  const sceneId = getCurrentLocationId(actorId)
    || (playerScene.playerId === actorId ? playerScene.scene?.id : null);
  const scene = sceneId ? getEntity(sceneId) : null;
  if (!scene || scene.kind !== 'scene') {
    throw new Error(`背包持有者 ${actorId} 当前不在有效场景中。`);
  }
  if (playerScene.playerId === actorId && playerScene.scene?.id === sceneId) {
    return playerScene;
  }

  const located = listRelationships({ entityId: sceneId, direction: 'in', type: 'located_in' })
    .map((relationship) => getEntity(relationship.sourceEntityId))
    .filter(Boolean);
  return {
    playerId: actorId,
    scene,
    residents: located.filter((entity) => entity.kind === 'character'),
    items: located.filter((entity) => entity.kind === 'item'),
  };
}

function buildInventoryTargets(actorId, scene) {
  return [getEntity(actorId), ...(scene.residents || [])]
    .filter(Boolean)
    .filter((entity, index, all) => all.findIndex((candidate) => candidate.id === entity.id) === index)
    .map((entity) => {
      const stats = getComponent(entity.id, 'stats') || {};
      const status = getComponent(entity.id, 'status') || {};
      const currentHitPoints = finiteNumber(stats.currentHitPoints, Number.NaN);
      const maxHitPoints = finiteNumber(stats.maxHitPoints, Number.NaN);
      return {
        id: entity.id,
        name: entity.name,
        kind: entity.kind,
        vitalState: status.state === 'dead' || status.alive === false ? 'dead' : status.canAct === false ? 'incapacitated' : 'active',
        health: Number.isFinite(currentHitPoints) && Number.isFinite(maxHitPoints)
          ? { currentHitPoints, maxHitPoints }
          : null,
      };
    });
}

function normalizeItemRules(identity, rules) {
  const role = String(identity.role || 'item');
  const inferredCategory = role === 'weapon'
    ? 'weapon'
    : role === 'consumable'
      ? 'consumable'
      : ['key_item', 'quest_token', 'final_choice_key'].includes(role)
        ? 'quest'
        : role === 'clue'
          ? 'clue'
          : 'tool';
  const use = rules.use && typeof rules.use === 'object'
    ? rules.use
    : role === 'weapon'
      ? { type: 'equip', target: 'self' }
      : ['key_item', 'quest_token', 'clue', 'final_choice_key'].includes(role)
        ? { type: 'narrative', target: 'optional_character' }
        : null;
  return {
    category: String(rules.category || inferredCategory),
    stackable: rules.stackable === true,
    droppable: rules.droppable !== false,
    equipSlot: rules.equipSlot || (role === 'weapon' ? 'weapon' : null),
    use,
  };
}

function createItemAction({ kind, label, actorId, itemId, targetMode, requiresTarget = false, validTargetIds = [], disabledReason = null, danger = false }) {
  return {
    id: `${kind}:${actorId}:${itemId}`,
    kind,
    label,
    actorId,
    itemId,
    targetMode,
    requiresTarget,
    validTargetIds,
    disabledReason,
    danger,
  };
}

function consumeOwnedQuantity(actorId, itemId, consumeQuantity = 1) {
  const relationship = listRelationships({ entityId: actorId, direction: 'out', type: 'ownership' })
    .find((candidate) => candidate.targetEntityId === itemId);
  if (!relationship) throw new Error('你已经不再持有这个道具。');
  const current = normalizeQuantity(relationship.data?.quantity);
  const consumed = Math.max(1, Math.floor(finiteNumber(consumeQuantity, 1)));
  if (current < consumed) throw new Error('道具数量不足。');
  const next = current - consumed;
  if (next <= 0) {
    deleteRelationship(actorId, itemId, 'ownership');
    return 0;
  }
  upsertRelationship(actorId, itemId, 'ownership', relationship.value, { ...relationship.data, quantity: next });
  return next;
}

function syncLegacyInventoryMirror(actorId) {
  const inventory = getComponent(actorId, 'inventory') || {};
  const items = listRelationships({ entityId: actorId, direction: 'out', type: 'ownership' })
    .filter((relationship) => getEntity(relationship.targetEntityId)?.kind === 'item')
    .map((relationship) => relationship.targetEntityId);
  const next = { ...inventory, items };
  if (next.equippedWeaponId && !items.includes(next.equippedWeaponId)) {
    delete next.equippedWeaponId;
  }
  upsertComponent(actorId, 'inventory', next);
}

function compareInventoryItems(left, right) {
  const order = { weapon: 0, consumable: 1, tool: 2, quest: 3, clue: 4 };
  return (order[left.category] ?? 9) - (order[right.category] ?? 9) || left.name.localeCompare(right.name, 'zh-CN');
}

function normalizeQuantity(value) {
  const quantity = Math.floor(finiteNumber(value, 1));
  return Math.max(1, quantity);
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
