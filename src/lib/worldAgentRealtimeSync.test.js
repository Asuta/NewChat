import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getExecutedWorldActionResult,
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

const successfulWorldAction = {
  tool: 'execute_world_action',
  args: {
    actionKind: 'attack.unarmed',
    actorId: 'character_wandering_child',
    targetId: 'player',
  },
  result: {
    ok: true,
    eventId: 77,
    result: {
      type: 'attack.resolved',
      action: {
        id: 'attack.unarmed:character_wandering_child:player',
        kind: 'attack.unarmed',
        label: '使用徒手攻击',
        actorId: 'character_wandering_child',
        targetId: 'player',
        targetName: '马大帅',
        attackName: '徒手',
      },
      facts: { hit: true, critical: false },
      stateChanges: [],
      narrationHints: {},
      summary: '流浪孩子小头领的反击命中。',
    },
    summary: '流浪孩子小头领的反击命中。',
  },
};

test('successful world actions, scene transitions, departures and world patches request an immediate UI sync', () => {
  assert.equal(isSuccessfulRealtimeWorldMutationStep(successfulWorldAction), true);
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
    step: successfulWorldAction,
    realtimeSnapshot,
  }), realtimeSnapshot);
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

test('a successful agent world action exposes its authoritative attack result for UI feedback', () => {
  assert.deepEqual(getExecutedWorldActionResult(successfulWorldAction), {
    eventId: 77,
    result: successfulWorldAction.result.result,
  });
  assert.equal(getExecutedWorldActionResult({
    ...successfulWorldAction,
    result: { ok: false, error: '动作失效' },
  }), null);
  assert.equal(getExecutedWorldActionResult({
    ...successfulWorldAction,
    result: { ok: true, eventId: 77 },
  }), null);
  assert.equal(getExecutedWorldActionResult({
    ...successfulWorldAction,
    tool: 'get_world_actions',
  }), null);
});
