import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getWorldRealtimeSnapshot,
  isSuccessfulRealtimeWorldMutationStep,
} from './worldAgentRealtimeSync.ts';

const successfulTransition = {
  tool: 'transition_scene',
  args: { sceneId: 'scene_outer_gate' },
  result: { ok: true, scene: { id: 'scene_outer_gate', name: '王都外门' } },
};

const successfulWorldPatch = {
  tool: 'apply_world_patch',
  args: { operations: [{ op: 'set_location', entityId: 'character_yufen' }] },
  result: { ok: true },
};

const successfulLeaveScene = {
  tool: 'leave_scene',
  args: { departures: [{ entityId: 'character_wandering_child', reason: '离开。' }] },
  result: { ok: true },
};

test('successful scene transitions, departures and world patches request an immediate UI sync', () => {
  assert.equal(isSuccessfulRealtimeWorldMutationStep(successfulTransition), true);
  assert.equal(isSuccessfulRealtimeWorldMutationStep(successfulLeaveScene), true);
  assert.equal(isSuccessfulRealtimeWorldMutationStep(successfulWorldPatch), true);
  assert.equal(isSuccessfulRealtimeWorldMutationStep({
    ...successfulTransition,
    result: { ok: false, error: '出口被封锁' },
  }), false);
  assert.equal(isSuccessfulRealtimeWorldMutationStep({
    ...successfulWorldPatch,
    result: { ok: false },
  }), false);
  assert.equal(isSuccessfulRealtimeWorldMutationStep({
    ...successfulTransition,
    tool: 'get_current_scene',
  }), false);
});

test('only a successful realtime world mutation exposes its snapshot', () => {
  const realtimeSnapshot = {
    world: { currentScene: { scene: { id: 'scene_outer_gate' } } },
    worldMap: { currentSceneId: 'scene_outer_gate', scenes: [], links: [] },
    presentationStage: { scene: { id: 'scene_outer_gate' }, characters: [] },
    inventory: { actor: { id: 'player' }, owned: [], nearby: [] },
  };

  assert.equal(getWorldRealtimeSnapshot({
    type: 'step',
    step: successfulTransition,
    realtimeSnapshot,
  }), realtimeSnapshot);
  assert.equal(getWorldRealtimeSnapshot({
    type: 'step',
    step: successfulLeaveScene,
    realtimeSnapshot,
  }), realtimeSnapshot);
  assert.equal(getWorldRealtimeSnapshot({
    type: 'step',
    step: successfulWorldPatch,
    realtimeSnapshot,
  }), realtimeSnapshot);
  assert.equal(getWorldRealtimeSnapshot({
    type: 'step',
    step: { ...successfulTransition, result: { ok: false } },
    realtimeSnapshot,
  }), null);
  assert.equal(getWorldRealtimeSnapshot({
    type: 'done',
    answer: '',
    runId: 1,
    steps: [],
    world: realtimeSnapshot.world,
  }), null);
});
