import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addInventoryItemReference,
  formatUserMessageWithItemReferences,
  hasInventoryItemDragType,
  INVENTORY_ITEM_DRAG_MIME_TYPE,
  sanitizeInventoryItemReferences,
} from './inventoryItemReferences.ts';
import { buildContextEvents } from './chat.ts';

test('inventory item references are deduplicated and malformed entries are ignored', () => {
  const references = sanitizeInventoryItemReferences([
    { itemId: 'item_sword', name: '礼拜堂铁剑', category: 'weapon', quantity: 1, equipped: true },
    { itemId: 'item_sword', name: '重复的铁剑', category: 'weapon', quantity: 2 },
    { itemId: '', name: '无效道具' },
  ]);

  assert.deepEqual(references, [{
    itemId: 'item_sword',
    name: '礼拜堂铁剑',
    category: 'weapon',
    quantity: 1,
    equipped: true,
  }]);
});

test('referenced items add entity context without claiming the action already happened', () => {
  const prompt = formatUserMessageWithItemReferences('我想用它撬开石门。', [{
    itemId: 'item_sword',
    name: '礼拜堂铁剑',
    category: 'weapon',
    quantity: 1,
    equipped: true,
  }]);

  assert.match(prompt, /"entityId":"item_sword"/);
  assert.match(prompt, /不代表任何使用、装备、消耗/);
  assert.match(prompt, /我想用它撬开石门。$/);
  assert.equal(formatUserMessageWithItemReferences('普通行动', []), '普通行动');
});

test('item references have no count limit and do not duplicate the same item', () => {
  const items = Array.from({ length: 40 }, (_, index) => ({
    id: `item_${index}`,
    name: `道具 ${index}`,
    category: 'tool',
    quantity: 1,
    equipped: false,
  }));
  const references = items.reduce(addInventoryItemReference, []);
  const duplicateResult = addInventoryItemReference(references, items[0]);

  assert.equal(references.length, 40);
  assert.equal(duplicateResult, references);
  assert.equal(hasInventoryItemDragType([INVENTORY_ITEM_DRAG_MIME_TYPE]), true);
  assert.equal(hasInventoryItemDragType(['text/plain']), false);
});

test('an unbounded referenced turn can be excluded from history and sent only as the current prompt', () => {
  const itemReferences = Array.from({ length: 200 }, (_, index) => ({
    itemId: `item_${index}`,
    name: `任意世界中的测试道具名称 ${index}`,
    category: 'quest',
    quantity: 1,
    equipped: false,
  }));
  const previousMessage = {
    id: 'previous',
    role: 'assistant',
    content: '上一轮叙事',
    createdAt: 1,
    status: 'done',
  };
  const currentMessage = {
    id: 'current',
    role: 'user',
    content: '请根据这些道具制定行动。',
    createdAt: 2,
    status: 'done',
    itemReferences,
  };
  const conversation = {
    id: 'conversation',
    title: '测试',
    createdAt: 1,
    updatedAt: 2,
    contextMode: 'full-history',
    messages: [previousMessage, currentMessage],
  };
  const prompt = formatUserMessageWithItemReferences(currentMessage.content, itemReferences);
  const contextEvents = buildContextEvents(conversation, conversation.messages, currentMessage.id);

  assert.ok(prompt.length > 16000);
  assert.deepEqual(contextEvents, [{ type: 'message', role: 'assistant', content: '上一轮叙事' }]);
  assert.equal(contextEvents.some((event) => event.type === 'message' && event.content === prompt), false);
  assert.match(prompt, /请根据这些道具制定行动。$/);
});
