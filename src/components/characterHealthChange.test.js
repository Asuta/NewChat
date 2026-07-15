import assert from 'node:assert/strict';
import test from 'node:test';
import { createCharacterHealthChangeEvent, getHealthPercentage } from './characterHealthChange.ts';

test('health change identifies damage and preserves the previous health range', () => {
  const event = createCharacterHealthChangeEvent(
    'character:1',
    { currentHitPoints: 18, maxHitPoints: 24 },
    { currentHitPoints: 11, maxHitPoints: 24 },
  );

  assert.deepEqual(event, {
    id: 'character:1',
    kind: 'damage',
    amount: 7,
    fromPercentage: 75,
    toPercentage: (11 / 24) * 100,
  });
});

test('health change identifies healing and reports the recovered amount', () => {
  const event = createCharacterHealthChangeEvent(
    'character:2',
    { currentHitPoints: 3, maxHitPoints: 12 },
    { currentHitPoints: 9, maxHitPoints: 12 },
  );

  assert.deepEqual(event, {
    id: 'character:2',
    kind: 'heal',
    amount: 6,
    fromPercentage: 25,
    toPercentage: 75,
  });
});

test('health change keeps visual ranges directional when maximum hit points change', () => {
  const healing = createCharacterHealthChangeEvent(
    'character:capacity-heal',
    { currentHitPoints: 10, maxHitPoints: 10 },
    { currentHitPoints: 11, maxHitPoints: 20 },
  );
  const damage = createCharacterHealthChangeEvent(
    'character:capacity-damage',
    { currentHitPoints: 10, maxHitPoints: 20 },
    { currentHitPoints: 9, maxHitPoints: 10 },
  );

  assert.equal(healing?.kind, 'heal');
  assert.equal(healing?.fromPercentage, 50);
  assert.equal(healing?.toPercentage, (11 / 20) * 100);
  assert.ok(healing.fromPercentage <= healing.toPercentage);

  assert.equal(damage?.kind, 'damage');
  assert.equal(damage?.fromPercentage, 100);
  assert.equal(damage?.toPercentage, 90);
  assert.ok(damage.fromPercentage >= damage.toPercentage);
});

test('health change ignores stable hit points and safely clamps percentages', () => {
  assert.equal(createCharacterHealthChangeEvent(
    'character:3',
    { currentHitPoints: 5, maxHitPoints: 10 },
    { currentHitPoints: 5, maxHitPoints: 20 },
  ), null);
  assert.equal(getHealthPercentage(15, 10), 100);
  assert.equal(getHealthPercentage(-2, 10), 0);
  assert.equal(getHealthPercentage(4, 0), 0);
});
