import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatMessage, PresentationStageCharacter } from '../types';
import { buildPortraitStatesByEntity, resolveCharacterPortrait } from './portraitState';

function createCharacter(overrides: Partial<PresentationStageCharacter> = {}): PresentationStageCharacter {
  return {
    entityId: 'npc',
    name: 'NPC',
    kind: 'character',
    health: { currentHitPoints: 10, maxHitPoints: 10 },
    vitalState: 'active',
    portraitUrl: '/neutral.png',
    portraitUrls: {
      neutral: '/neutral.png',
      angry: '/angry.png',
      hurt: '/hurt.png',
      wounded: '/wounded.png',
    },
    position: 'auto',
    slot: 'center',
    scale: 1,
    hasBinding: true,
    isFallbackPortrait: false,
    ...overrides,
  };
}

test('latest NPC speech state persists until a scene transition', () => {
  const messages = [
    { kind: 'npc-speech', npcSpeech: { entityId: 'one', name: 'One', portraitState: 'happy' } },
    { kind: 'npc-speech', npcSpeech: { entityId: 'two', name: 'Two', portraitState: 'angry' } },
    { kind: 'scene-transition' },
    { kind: 'npc-speech', npcSpeech: { entityId: 'one', name: 'One', portraitState: 'disappointed' } },
  ] as ChatMessage[];

  assert.deepEqual(buildPortraitStatesByEntity(messages), { one: 'disappointed' });
});

test('scene visit ids keep post-transition speech even when the transition marker is appended last', () => {
  const messages = [
    {
      kind: 'npc-speech',
      npcSpeech: { entityId: 'one', name: 'One', portraitState: 'angry', sceneVisitId: 'visit-old' },
    },
    {
      kind: 'npc-speech',
      npcSpeech: { entityId: 'two', name: 'Two', portraitState: 'happy', sceneVisitId: 'visit-new' },
    },
    { kind: 'scene-transition' },
  ] as ChatMessage[];

  assert.deepEqual(buildPortraitStatesByEntity(messages, 'visit-new'), { two: 'happy' });
});

test('hit reaction and low health override spoken emotion in order', () => {
  const healthy = createCharacter();
  const wounded = createCharacter({ health: { currentHitPoints: 4, maxHitPoints: 10 } });

  assert.equal(resolveCharacterPortrait(healthy, 'angry', true).state, 'hurt');
  assert.equal(resolveCharacterPortrait(wounded, 'angry', false).state, 'wounded');
  assert.equal(resolveCharacterPortrait(healthy, 'angry', false).state, 'angry');
});

test('missing variants fall back to the default portrait', () => {
  const character = createCharacter({
    portraitUrls: { neutral: '/neutral.png', angry: '/angry.png' },
  });
  assert.deepEqual(resolveCharacterPortrait(character, 'angry', true), {
    state: 'neutral',
    url: '/neutral.png',
    isFallback: false,
  });
  assert.deepEqual(resolveCharacterPortrait(
    { ...character, health: { currentHitPoints: 4, maxHitPoints: 10 } },
    'angry',
    false,
  ), {
    state: 'neutral',
    url: '/neutral.png',
    isFallback: false,
  });
});
