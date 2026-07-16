import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createWorldDbSchema } from './worldDbSchema.js';
import { ensureTemplatePlayableDefaults } from './saveManager.js';

test('旧模板升级后重置游戏可获得全部角色生命值', () => {
  const directory = mkdtempSync(join(tmpdir(), 'newchat-template-'));
  const databaseFile = join(directory, 'template.sqlite');
  const database = new DatabaseSync(databaseFile);

  try {
    createWorldDbSchema(database);
    const insertEntity = database.prepare(`
      INSERT INTO entities (id, kind, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    insertEntity.run('player', 'player', '失忆王选者', now, now);

    const expectedHitPoints = new Map([
      ['character_elena', 22],
      ['character_rowan', 14],
      ['character_milo', 10],
      ['character_aldric', 30],
      ['character_eve', 18],
      ['character_kaen', 20],
      ['character_hollow_knight', 18],
      ['character_crown_will', 36],
    ]);
    for (const entityId of expectedHitPoints.keys()) {
      insertEntity.run(entityId, 'character', entityId, now, now);
    }
    database.close();

    ensureTemplatePlayableDefaults(databaseFile);

    const upgradedDatabase = new DatabaseSync(databaseFile, { readOnly: true });
    try {
      const readStats = upgradedDatabase.prepare(
        "SELECT data_json FROM components WHERE entity_id = ? AND type = 'stats'",
      );
      for (const [entityId, maxHitPoints] of expectedHitPoints) {
        const row = readStats.get(entityId);
        assert.ok(row, `${entityId} 缺少 stats 组件`);
        const stats = JSON.parse(row.data_json);
        assert.equal(stats.maxHitPoints, maxHitPoints);
        assert.equal(stats.currentHitPoints, maxHitPoints);
      }
    } finally {
      upgradedDatabase.close();
    }
  } finally {
    try {
      database.close();
    } catch {
      // The database is deliberately closed before the template upgrade.
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
