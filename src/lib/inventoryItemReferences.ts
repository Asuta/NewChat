import type { InventoryItem, InventoryItemReference } from '../types';

export const INVENTORY_ITEM_DRAG_MIME_TYPE = 'application/x-newchat-inventory-item';

const ITEM_REFERENCE_CONTEXT_PREFIX = [
  '玩家在本轮明确引用了以下背包道具。',
  '这些引用只用于消除实体歧义，不代表任何使用、装备、消耗或其他道具动作已经执行。',
  '如需改变背包或世界状态，必须先读取当前背包，并调用经过校验的道具工具。',
].join('');

export function createInventoryItemReference(item: InventoryItem): InventoryItemReference {
  return {
    itemId: item.id,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    equipped: item.equipped,
  };
}

export function addInventoryItemReference(
  references: InventoryItemReference[],
  item: InventoryItem,
): InventoryItemReference[] {
  if (references.some((reference) => reference.itemId === item.id)) return references;
  return [...references, createInventoryItemReference(item)];
}

export function hasInventoryItemDragType(types: Iterable<string>): boolean {
  return Array.from(types).includes(INVENTORY_ITEM_DRAG_MIME_TYPE);
}

export function sanitizeInventoryItemReferences(value: unknown): InventoryItemReference[] {
  if (!Array.isArray(value)) return [];
  const seenItemIds = new Set<string>();
  const references: InventoryItemReference[] = [];

  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') continue;
    const record = candidate as Partial<InventoryItemReference>;
    const itemId = typeof record.itemId === 'string' ? record.itemId.trim() : '';
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!itemId || !name || seenItemIds.has(itemId)) continue;
    seenItemIds.add(itemId);
    references.push({
      itemId,
      name,
      category: typeof record.category === 'string' && record.category.trim()
        ? record.category.trim()
        : 'item',
      quantity: typeof record.quantity === 'number' && Number.isFinite(record.quantity)
        ? Math.max(1, Math.floor(record.quantity))
        : 1,
      equipped: record.equipped === true,
    });
  }

  return references;
}

export function formatUserMessageWithItemReferences(
  content: string,
  itemReferences: unknown,
): string {
  const references = sanitizeInventoryItemReferences(itemReferences);
  if (!references.length) return content;

  const referencePayload = references.map((reference) => ({
    entityId: reference.itemId,
    name: reference.name,
    category: reference.category,
    quantityAtSend: reference.quantity,
    equippedAtSend: reference.equipped,
  }));
  return [
    ITEM_REFERENCE_CONTEXT_PREFIX,
    JSON.stringify({ referencedInventoryItems: referencePayload }),
    '玩家行动：',
    content,
  ].join('\n');
}
