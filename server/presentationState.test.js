import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { derivePresentationVitalState } from './presentationState.js';

const WORLD_DB_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'worldDb.js')).href;
const PRESENTATION_DB_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'presentationDb.js')).href;

test('presentation vital state keeps zero-hit-point characters incapacitated rather than dead', () => {
  assert.equal(
    derivePresentationVitalState(
      { state: 'incapacitated', label: '失能', canAct: false },
      { currentHitPoints: 0, maxHitPoints: 22 },
    ),
    'incapacitated',
  );
});

test('presentation vital state gives explicit death precedence over remaining hit points', () => {
  assert.equal(
    derivePresentationVitalState(
      { state: 'dead', label: '死亡', canAct: false },
      { currentHitPoints: 7, maxHitPoints: 22 },
    ),
    'dead',
  );
  assert.equal(
    derivePresentationVitalState(
      { state: 'active', alive: false, label: '死亡', canAct: false },
      { currentHitPoints: 7, maxHitPoints: 22 },
    ),
    'dead',
  );
});

test('presentation vital state treats unconscious conditions as recoverable incapacitation', () => {
  assert.equal(
    derivePresentationVitalState(
      { state: 'active', conditions: ['unconscious'], label: '昏迷', canAct: false },
      { currentHitPoints: 5, maxHitPoints: 22 },
    ),
    'incapacitated',
  );
});

test('presentation vital state leaves unrelated non-acting states visually active', () => {
  assert.equal(
    derivePresentationVitalState(
      { state: 'dormant', label: '沉睡', canAct: false },
      null,
    ),
    'active',
  );
});

test('current presentation stage exposes normalized incapacitated and dead states', () => {
  const result = runIsolatedPresentationScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const presentationDb = await import(${JSON.stringify(PRESENTATION_DB_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    presentationDb.ensurePresentationDb();
    worldDb.setCurrentLocation('character_yufen', 'scene_bus_station', 'test');

    worldDb.upsertComponent('character_yufen', 'stats', { currentHitPoints: 0, maxHitPoints: 14 });
    worldDb.upsertComponent('character_yufen', 'status', {
      state: 'incapacitated',
      label: '失能',
      description: '玉芬因伤势倒下。',
      canAct: false,
    });
    const incapacitatedStage = presentationDb.getCurrentPresentationStage(worldDb.getCurrentScene());

    worldDb.upsertComponent('character_yufen', 'status', {
      state: 'dead',
      label: '死亡',
      description: '玉芬已经死亡。',
      canAct: false,
    });
    const deadStage = presentationDb.getCurrentPresentationStage(worldDb.getCurrentScene());
    worldDb.closeWorldDb();

    const findYufen = (stage) => stage.characters.find((character) => character.entityId === 'character_yufen');
    console.log(JSON.stringify({
      player: incapacitatedStage.player,
      incapacitated: findYufen(incapacitatedStage),
      dead: findYufen(deadStage),
    }));
  `);

  assert.equal(result.player.entityId, 'player');
  assert.equal(result.player.name, '马大帅');
  assert.equal(result.player.level, 1);
  assert.equal(result.player.armorClass, 11);
  assert.deepEqual(result.player.health, { currentHitPoints: 14, maxHitPoints: 14 });
  assert.equal(result.player.statusLabel, '进城寻女，身无分文');
  assert.equal(result.player.canAct, true);
  assert.equal(result.incapacitated.vitalState, 'incapacitated');
  assert.equal(result.incapacitated.health.currentHitPoints, 0);
  assert.equal(result.dead.vitalState, 'dead');
});

function runIsolatedPresentationScript(script) {
  const cwd = mkdtempSync(join(tmpdir(), 'newchat-presentation-state-'));
  try {
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd,
      encoding: 'utf8',
    });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    return JSON.parse(child.stdout.trim().split(/\r?\n/).at(-1) || 'null');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
