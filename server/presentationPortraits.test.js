import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergePortraitAssetIds,
  NPC_SPEECH_PORTRAIT_STATES,
  normalizePortraitState,
  readPortraitAssetIds,
} from './presentationPortraits.js';

test('portrait state normalization falls back to neutral', () => {
  assert.equal(normalizePortraitState('ANGRY'), 'angry');
  assert.equal(normalizePortraitState('unknown'), 'neutral');
  assert.equal(normalizePortraitState(undefined), 'neutral');
});

test('NPC speech only exposes emotional states to the model', () => {
  assert.deepEqual(NPC_SPEECH_PORTRAIT_STATES, [
    'neutral',
    'happy',
    'angry',
    'disappointed',
  ]);
});

test('portrait metadata only exposes supported non-empty states', () => {
  assert.deepEqual(readPortraitAssetIds({
    portraits: {
      happy: ' asset_happy ',
      hurt: '',
      surprised: 'asset_surprised',
    },
  }), { happy: 'asset_happy' });
});

test('discovered portraits do not overwrite existing manual bindings', () => {
  assert.deepEqual(mergePortraitAssetIds({
    label: 'NPC',
    portraits: { angry: 'asset_manual_angry' },
  }, {
    angry: 'asset_discovered_angry',
    wounded: 'asset_discovered_wounded',
  }), {
    label: 'NPC',
    portraits: {
      angry: 'asset_manual_angry',
      wounded: 'asset_discovered_wounded',
    },
  });
});
