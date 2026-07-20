import assert from 'node:assert/strict';
import test from 'node:test';
import type { PresentationPlayerStatus } from '../types';
import { getPlayerStatusHudView } from './PlayerStatusHud';

function createPlayer(overrides: Partial<PresentationPlayerStatus> = {}): PresentationPlayerStatus {
  return {
    entityId: 'player',
    name: '马大帅',
    level: 1,
    armorClass: 14,
    health: { currentHitPoints: 12, maxHitPoints: 12 },
    vitalState: 'active',
    statusLabel: '刚刚苏醒',
    canAct: true,
    ...overrides,
  };
}

test('healthy player HUD preserves the world status and core values', () => {
  assert.deepEqual(getPlayerStatusHudView(createPlayer()), {
    healthPercentage: 100,
    healthText: '12 / 12',
    armorClassText: '14',
    statusLabel: '刚刚苏醒',
    tone: 'healthy',
  });
});

test('health thresholds override a stale healthy status label', () => {
  assert.equal(getPlayerStatusHudView(createPlayer({
    health: { currentHitPoints: 6, maxHitPoints: 12 },
  })).statusLabel, '受伤');
  assert.equal(getPlayerStatusHudView(createPlayer({
    health: { currentHitPoints: 3, maxHitPoints: 12 },
  })).statusLabel, '濒危');
});

test('incapacitated and dead states take precedence over health', () => {
  assert.equal(getPlayerStatusHudView(createPlayer({
    vitalState: 'incapacitated',
    statusLabel: '昏迷',
    canAct: false,
  })).tone, 'incapacitated');
  assert.equal(getPlayerStatusHudView(createPlayer({
    vitalState: 'dead',
    health: { currentHitPoints: 0, maxHitPoints: 12 },
    canAct: false,
  })).statusLabel, '已死亡');
});

test('missing health data stays neutral instead of reporting a critical condition', () => {
  assert.deepEqual(getPlayerStatusHudView(createPlayer({
    health: null,
    statusLabel: '',
  })), {
    healthPercentage: 0,
    healthText: '-- / --',
    armorClassText: '14',
    statusLabel: '生命未知',
    tone: 'unknown',
  });
});
