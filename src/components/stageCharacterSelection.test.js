import assert from 'node:assert/strict';
import test from 'node:test';
import { getVisibleStageCharacters } from './stageCharacterSelection.ts';
import { classifyStageCharacterMotions } from './stageCharacterTransitions.ts';

function createCharacter(entityId) {
  return { entityId, position: 'auto' };
}

test('all scene characters remain visible when the stage has more than three residents', () => {
  const characters = ['one', 'two', 'three', 'four', 'five'].map(createCharacter);

  const visible = getVisibleStageCharacters(characters);

  assert.deepEqual(
    visible.map((character) => character.entityId),
    ['one', 'two', 'three', 'four', 'five'],
  );
});

test('a crowded stage distributes everyone across its width and scales portraits down', () => {
  const characters = ['one', 'two', 'three', 'four', 'five'].map(createCharacter);

  const visible = getVisibleStageCharacters(characters);

  assert.deepEqual(
    visible.map((character) => character.stageLeftPercent),
    [10, 30, 50, 70, 90],
  );
  assert.ok(visible.every((character) => approximatelyEqual(character.stageCrowdScale, 9 / 14)));
});

test('crowded stage layout has no hard character maximum', () => {
  const characters = Array.from({ length: 20 }, (_, index) => createCharacter(`character-${index}`));

  const visible = getVisibleStageCharacters(characters);

  assert.equal(visible.length, 20);
  assert.equal(visible[0].stageLeftPercent, 10);
  assert.equal(visible.at(-1).stageLeftPercent, 90);
  assert.ok(visible.every((character) => approximatelyEqual(character.stageCrowdScale, 18 / 133)));
});

test('crowded character hit boxes do not overlap even with custom portrait scaling', () => {
  for (const characterCount of [4, 5, 20, 100]) {
    const characters = Array.from({ length: characterCount }, (_, index) => ({
      ...createCharacter(`character-${index}`),
      scale: index === 1 ? 2 : 1,
    }));
    const visible = getVisibleStageCharacters(characters);
    const characterSpacing = visible[1].stageLeftPercent - visible[0].stageLeftPercent;

    for (const character of visible) {
      const renderedWidth = character.stageWidthPercent * character.scale * character.stageCrowdScale;
      assert.ok(
        renderedWidth < characterSpacing,
        `${characterCount} residents produced a ${renderedWidth}% hit box with only ${characterSpacing}% spacing`,
      );
    }
  }
});

test('the existing slots stay unchanged when at most three characters are present', () => {
  const visible = getVisibleStageCharacters(['one', 'two', 'three'].map(createCharacter));

  assert.deepEqual(
    visible.map((character) => [character.entityId, character.slot, character.stageCrowdScale]),
    [['one', 'left', 1], ['two', 'center', 1], ['three', 'right', 1]],
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

test('rendered residents use a short focus transition when their visibility changes', () => {
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

function approximatelyEqual(actual, expected) {
  return Math.abs(actual - expected) < Number.EPSILON * 4;
}
