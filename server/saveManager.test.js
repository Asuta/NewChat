import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  MA_DASHUAI_CHARACTER_HIT_POINTS,
  MA_DASHUAI_PRESET_REVISION,
} from './defaultWorld.js';
import { createWorldDbSchema } from './worldDbSchema.js';
import {
  ensureBuiltInStoryBlueprintDefaults,
  ensureStoryBlueprintForCampaign,
  ensureTemplatePlayableDefaults,
  STORY_BLUEPRINT_CONTEXT_FILE_NAME,
  syncSystemContextFiles,
} from './saveManager.js';

test('系统上下文同步不会覆盖世界作者的剧情蓝图', () => {
  const directory = mkdtempSync(join(tmpdir(), 'newchat-context-sync-'));
  const sourceDir = join(directory, 'factory');
  const targetDir = join(directory, 'world');

  try {
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(sourceDir, '010-world-agent-role.md'), '项目系统规则', 'utf8');
    writeFileSync(join(sourceDir, STORY_BLUEPRINT_CONTEXT_FILE_NAME), '项目默认剧情', 'utf8');
    writeFileSync(join(targetDir, '010-world-agent-role.md'), '导入世界的旧系统规则', 'utf8');
    writeFileSync(join(targetDir, STORY_BLUEPRINT_CONTEXT_FILE_NAME), '导入世界的剧情', 'utf8');

    syncSystemContextFiles(sourceDir, targetDir);

    assert.equal(readFileSync(join(targetDir, '010-world-agent-role.md'), 'utf8'), '项目系统规则');
    assert.equal(readFileSync(join(targetDir, STORY_BLUEPRINT_CONTEXT_FILE_NAME), 'utf8'), '导入世界的剧情');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('世界模板的剧情蓝图会同步到当前存档', () => {
  const directory = mkdtempSync(join(tmpdir(), 'newchat-story-sync-'));
  const templateDir = join(directory, 'template');
  const saveDir = join(directory, 'save');

  try {
    mkdirSync(templateDir, { recursive: true });
    mkdirSync(saveDir, { recursive: true });
    writeFileSync(join(templateDir, STORY_BLUEPRINT_CONTEXT_FILE_NAME), '世界作者剧情', 'utf8');
    writeFileSync(join(saveDir, STORY_BLUEPRINT_CONTEXT_FILE_NAME), '过期存档剧情', 'utf8');

    syncSystemContextFiles(templateDir, saveDir, { syncStoryBlueprint: true });

    assert.equal(
      readFileSync(join(saveDir, STORY_BLUEPRINT_CONTEXT_FILE_NAME), 'utf8'),
      '世界作者剧情',
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('导入世界不会因为战役 ID 相同而被注入内置剧情', () => {
  const directory = mkdtempSync(join(tmpdir(), 'newchat-imported-story-'));
  const factoryContextDir = join(directory, 'factory-context');
  const templateContextDir = join(directory, 'template-context');
  const saveContextDir = join(directory, 'save-context');
  const templateDatabaseFile = join(directory, 'template.sqlite');
  const saveDatabaseFile = join(directory, 'save.sqlite');
  const templateImportMarkerFile = join(directory, '.imported-world');

  try {
    mkdirSync(factoryContextDir, { recursive: true });
    writeFileSync(join(factoryContextDir, STORY_BLUEPRINT_CONTEXT_FILE_NAME), '内置剧情', 'utf8');
    writeFileSync(templateImportMarkerFile, '', 'utf8');

    for (const databaseFile of [templateDatabaseFile, saveDatabaseFile]) {
      const database = new DatabaseSync(databaseFile);
      createWorldDbSchema(database);
      database.prepare("INSERT INTO meta (key, value) VALUES ('campaignId', 'ma-dashuai-city-life')").run();
      database.close();
    }

    ensureBuiltInStoryBlueprintDefaults({
      factoryContextDir,
      templateDatabaseFile,
      templateContextDir,
      saveDatabaseFile,
      saveContextDir,
      templateImportMarkerFile,
    });

    assert.equal(existsSync(join(templateContextDir, STORY_BLUEPRINT_CONTEXT_FILE_NAME)), false);
    assert.equal(existsSync(join(saveContextDir, STORY_BLUEPRINT_CONTEXT_FILE_NAME)), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('内置战役缺少剧情蓝图时只补齐一次', () => {
  const directory = mkdtempSync(join(tmpdir(), 'newchat-story-blueprint-'));
  const databaseFile = join(directory, 'world.sqlite');
  const contextDir = join(directory, 'context');
  const factoryStoryFile = join(directory, 'factory-story.md');
  const database = new DatabaseSync(databaseFile);

  try {
    createWorldDbSchema(database);
    database.prepare("INSERT INTO meta (key, value) VALUES ('campaignId', 'test-campaign')").run();
    database.close();
    writeFileSync(factoryStoryFile, '作者蓝图 v1', 'utf8');

    ensureStoryBlueprintForCampaign({
      databaseFile,
      contextDir,
      factoryStoryFile,
      campaignId: 'test-campaign',
    });

    const targetFile = join(contextDir, STORY_BLUEPRINT_CONTEXT_FILE_NAME);
    assert.equal(readFileSync(targetFile, 'utf8'), '作者蓝图 v1');

    writeFileSync(targetFile, '世界包自己的蓝图', 'utf8');
    writeFileSync(factoryStoryFile, '作者蓝图 v2', 'utf8');
    ensureStoryBlueprintForCampaign({
      databaseFile,
      contextDir,
      factoryStoryFile,
      campaignId: 'test-campaign',
    });

    assert.equal(readFileSync(targetFile, 'utf8'), '世界包自己的蓝图');
  } finally {
    try {
      database.close();
    } catch {
      // The database is deliberately closed before blueprint migration.
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

test('马大帅旧模板升级后重置游戏可获得全部角色生命值', () => {
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
    insertEntity.run('player', 'player', '马大帅', now, now);
    database.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('campaignId', 'ma-dashuai-city-life');

    const expectedHitPoints = new Map(Object.entries(MA_DASHUAI_CHARACTER_HIT_POINTS));
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

test('马大帅 v2 旧模板升级后会拆分维多利亚内部场景和人物位置', () => {
  const directory = mkdtempSync(join(tmpdir(), 'newchat-victoria-template-'));
  const databaseFile = join(directory, 'template.sqlite');
  const database = new DatabaseSync(databaseFile);

  try {
    createWorldDbSchema(database);
    const now = new Date().toISOString();
    const insertEntity = database.prepare(`
      INSERT INTO entities (id, kind, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertEntity.run('player', 'player', '马大帅', now, now);
    insertEntity.run('scene_victoria', 'scene', '维多利亚娱乐广场', now, now);
    for (const [entityId, name] of [
      ['character_fan_debiao', '范德彪'],
      ['character_ma_xiaocui', '马小翠'],
      ['character_wu', '吴总'],
      ['character_awei', '阿薇'],
    ]) {
      insertEntity.run(entityId, 'character', name, now, now);
    }
    database.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('campaignId', 'ma-dashuai-city-life');
    database.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('presetRevision', 'ma-dashuai-episode-guide-v2');
    database.prepare(`
      INSERT INTO components (entity_id, type, data_json, updated_at)
      VALUES ('scene_victoria', 'scene', ?, ?)
    `).run(JSON.stringify({ description: '旧版复合场景', exits: [] }), now);
    const insertLocation = database.prepare(`
      INSERT INTO relationships (source_entity_id, target_entity_id, type, value, data_json, created_at, updated_at)
      VALUES (?, 'scene_victoria', 'located_in', NULL, '{}', ?, ?)
    `);
    for (const entityId of ['character_fan_debiao', 'character_ma_xiaocui', 'character_wu', 'character_awei']) {
      insertLocation.run(entityId, now, now);
    }
    database.close();

    ensureTemplatePlayableDefaults(databaseFile);

    const upgradedDatabase = new DatabaseSync(databaseFile, { readOnly: true });
    try {
      assert.equal(
        upgradedDatabase.prepare("SELECT value FROM meta WHERE key = 'presetRevision'").get()?.value,
        MA_DASHUAI_PRESET_REVISION,
      );
      for (const sceneId of ['scene_victoria_dance_hall', 'scene_victoria_office', 'scene_victoria_backstage']) {
        assert.equal(upgradedDatabase.prepare('SELECT kind FROM entities WHERE id = ?').get(sceneId)?.kind, 'scene');
        assert.ok(upgradedDatabase.prepare("SELECT 1 FROM components WHERE entity_id = ? AND type = 'scene'").get(sceneId));
      }

      const readLocation = upgradedDatabase.prepare(
        "SELECT target_entity_id AS targetEntityId FROM relationships WHERE source_entity_id = ? AND type = 'located_in'",
      );
      assert.equal(readLocation.get('character_fan_debiao')?.targetEntityId, 'scene_victoria');
      assert.equal(readLocation.get('character_ma_xiaocui')?.targetEntityId, 'scene_victoria_dance_hall');
      assert.equal(readLocation.get('character_wu')?.targetEntityId, 'scene_victoria_office');
      assert.equal(readLocation.get('character_awei')?.targetEntityId, 'scene_victoria_backstage');

      const hasExit = upgradedDatabase.prepare(`
        SELECT 1 FROM relationships
        WHERE source_entity_id = ? AND target_entity_id = ? AND type = 'exit_to'
      `);
      assert.ok(hasExit.get('scene_victoria', 'scene_victoria_office'));
      assert.ok(hasExit.get('scene_victoria_office', 'scene_victoria'));
      assert.ok(hasExit.get('scene_victoria_dance_hall', 'scene_victoria_backstage'));
      assert.ok(hasExit.get('scene_victoria_backstage', 'scene_victoria_dance_hall'));
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
