import assert from 'node:assert/strict';
import test from 'node:test';
import { getVisibleStageCharacters } from './stageCharacterSelection.ts';
import { classifyStageCharacterMotions } from './stageCharacterTransitions.ts';

function createCharacter(entityId) {
  return { entityId, position: 'auto' };
}

test('attack feedback keeps a target visible after the active speaker is cleared', () => {
  const characters = ['one', 'two', 'three', 'target'].map(createCharacter);

  const visible = getVisibleStageCharacters(characters, undefined, 'target');

  assert.deepEqual(
    visible.map((character) => [character.entityId, character.slot]),
    [['one', 'left'], ['two', 'center'], ['target', 'right']],
  );
});

test('attack feedback preserves both an off-screen speaker and a different target', () => {
  const characters = ['one', 'two', 'three', 'target', 'speaker'].map(createCharacter);

  const visible = getVisibleStageCharacters(characters, 'speaker', 'target');

  assert.deepEqual(
    visible.map((character) => [character.entityId, character.slot]),
    [['one', 'left'], ['target', 'center'], ['speaker', 'right']],
  );
});

test('a new scene resident gets a full entrance while existing characters only reposition', () => {
  assert.deepEqual(
    classifyStageCharacterMotions(
      ['one'],
      ['one'],
      ['one', 'two'],
      ['one', 'two'],
    ),
    { two: 'entering' },
  );
});

test('speaker-driven stage replacement uses a short focus transition', () => {
  assert.deepEqual(
    classifyStageCharacterMotions(
      ['one', 'two', 'three', 'speaker'],
      ['one', 'two', 'three'],
      ['one', 'two', 'three', 'speaker'],
      ['one', 'two', 'speaker'],
    ),
    {
      speaker: 'focus-entering',
      three: 'focus-exiting',
    },
  );
});

test('a resident leaving the current scene gets a full exit', () => {
  assert.deepEqual(
    classifyStageCharacterMotions(
      ['one', 'two'],
      ['one', 'two'],
      ['two'],
      ['two'],
    ),
    { one: 'exiting' },
  );
});
