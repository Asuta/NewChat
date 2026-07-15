import assert from 'node:assert/strict';
import test from 'node:test';
import { createCharacterAttackFeedbackEvent } from './characterAttackFeedback.ts';

test('attack feedback preserves an authoritative hit result', () => {
  const event = createCharacterAttackFeedbackEvent(42, {
    type: 'attack.resolved',
    action: {
      id: 'attack.weapon:player:character_elena:item_iron_sword',
      kind: 'attack.weapon',
      label: '攻击',
      actorId: 'player',
      targetId: 'character_elena',
      targetName: '艾蕾娜',
      weaponId: 'item_iron_sword',
      weaponName: '礼拜堂铁剑',
    },
    facts: { hit: true, critical: true },
    stateChanges: [],
    narrationHints: {},
    summary: '命中。',
  });

  assert.deepEqual(event, {
    id: 'attack:42',
    targetEntityId: 'character_elena',
    targetName: '艾蕾娜',
    hit: true,
    critical: true,
  });
});

test('attack feedback represents a miss without requiring a health change', () => {
  const event = createCharacterAttackFeedbackEvent('miss-7', {
    type: 'attack.resolved',
    action: {
      id: 'attack.weapon:player:character_elena:item_iron_sword',
      kind: 'attack.weapon',
      label: '攻击',
      actorId: 'player',
      targetId: 'character_elena',
      weaponId: 'item_iron_sword',
      weaponName: '礼拜堂铁剑',
    },
    facts: { hit: false, damage: 0 },
    stateChanges: [],
    narrationHints: {},
    summary: '未命中。',
  });

  assert.deepEqual(event, {
    id: 'attack:miss-7',
    targetEntityId: 'character_elena',
    targetName: 'character_elena',
    hit: false,
    critical: false,
  });
});

test('attack feedback ignores unrelated or malformed action results', () => {
  const baseResult = {
    type: 'item.used',
    facts: { hit: false },
    stateChanges: [],
    narrationHints: {},
    summary: '使用道具。',
  };

  assert.equal(createCharacterAttackFeedbackEvent(1, baseResult), null);
  assert.equal(createCharacterAttackFeedbackEvent(2, {
    ...baseResult,
    type: 'attack.resolved',
  }), null);
});
