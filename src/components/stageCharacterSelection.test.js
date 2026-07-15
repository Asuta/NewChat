import assert from 'node:assert/strict';
import test from 'node:test';
import { getVisibleStageCharacters } from './stageCharacterSelection.ts';

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
