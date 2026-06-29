import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { DatabaseSync } from 'node:sqlite';
import { listWorldSchemas } from './worldSchemas.js';

export const DATA_DIR = resolve(process.cwd(), 'data');
export const FACTORY_CONTEXT_DIR = resolve(process.cwd(), 'context');
export const FACTORY_RULES_DIR = resolve(process.cwd(), 'rules');
export const TEMPLATE_DIR = join(DATA_DIR, 'template');
export const SAVE_DIR = join(DATA_DIR, 'save');
export const TEMPLATE_CONTEXT_DIR = join(TEMPLATE_DIR, 'context');
export const SAVE_CONTEXT_DIR = join(SAVE_DIR, 'context');
export const TEMPLATE_RULES_DIR = join(TEMPLATE_DIR, 'rules');
export const SAVE_RULES_DIR = join(SAVE_DIR, 'rules');
export const TEMPLATE_DB_FILE = join(TEMPLATE_DIR, 'newchat.sqlite');
export const SAVE_DB_FILE = join(SAVE_DIR, 'newchat.sqlite');
export const SAVE_IMPORT_DB_FILE = join(SAVE_DIR, 'newchat.import.sqlite');
export const LEGACY_DB_FILE = join(DATA_DIR, 'newchat.sqlite');
export const USER_CONTEXT_FILE_NAME = '001-user-fixed-context.md';
export const SAVE_USER_CONTEXT_FILE = join(SAVE_CONTEXT_DIR, USER_CONTEXT_FILE_NAME);
export const GENERATED_SCHEMA_CONTEXT_FILE_NAME = '025-world-schema.generated.md';

const SQLITE_COMPANION_SUFFIXES = ['', '-wal', '-shm'];

export function ensureDataLayout() {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(TEMPLATE_DIR, { recursive: true });
  mkdirSync(SAVE_DIR, { recursive: true });

  if (!existsSync(SAVE_DB_FILE) && existsSync(LEGACY_DB_FILE)) {
    copySqliteFamily(LEGACY_DB_FILE, SAVE_DB_FILE);
  }

  if (!existsSync(TEMPLATE_DB_FILE) && existsSync(LEGACY_DB_FILE)) {
    copySqliteFamily(LEGACY_DB_FILE, TEMPLATE_DB_FILE);
  }

  if (isMissingOrEmptyDirectory(TEMPLATE_CONTEXT_DIR)) {
    copyDirectoryContents(FACTORY_CONTEXT_DIR, TEMPLATE_CONTEXT_DIR, { clear: true });
  }
  syncSystemContextFiles(FACTORY_CONTEXT_DIR, TEMPLATE_CONTEXT_DIR);

  syncGeneratedWorldSchemaContext(TEMPLATE_CONTEXT_DIR);

  if (isMissingOrEmptyDirectory(SAVE_CONTEXT_DIR)) {
    copyDirectoryContents(TEMPLATE_CONTEXT_DIR, SAVE_CONTEXT_DIR, { clear: true });
  }
  syncSystemContextFiles(TEMPLATE_CONTEXT_DIR, SAVE_CONTEXT_DIR);

  syncGeneratedWorldSchemaContext(SAVE_CONTEXT_DIR);

  if (isMissingOrEmptyDirectory(TEMPLATE_RULES_DIR)) {
    copyDirectoryContents(FACTORY_RULES_DIR, TEMPLATE_RULES_DIR, { clear: true });
  }
  copyMissingDirectoryFiles(FACTORY_RULES_DIR, TEMPLATE_RULES_DIR);

  if (isMissingOrEmptyDirectory(SAVE_RULES_DIR)) {
    copyDirectoryContents(TEMPLATE_RULES_DIR, SAVE_RULES_DIR, { clear: true });
  }
  copyMissingDirectoryFiles(TEMPLATE_RULES_DIR, SAVE_RULES_DIR);
}

export function ensureTemplateDbFromSaveIfMissing() {
  if (!hasWorldDbSchema(TEMPLATE_DB_FILE) && existsSync(SAVE_DB_FILE)) {
    copySqliteFamily(SAVE_DB_FILE, TEMPLATE_DB_FILE);
  }
}

export function ensureTemplatePlayableDefaults() {
  if (!hasWorldDbSchema(TEMPLATE_DB_FILE)) {
    return;
  }

  const database = new DatabaseSync(TEMPLATE_DB_FILE);
  try {
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec('BEGIN;');
    upsertTemplateEntity(database, 'item_longsword', 'item', '旧长剑');
    setTemplateAliases(database, 'item_longsword', ['长剑', 'Longsword']);
    mergeTemplateComponent(database, 'player', 'identity', {
      role: 'player',
      description: '玩家角色，刚抵达雾港。',
      class: 'fighter',
      level: 1,
    });
    mergeTemplateStats(database, 'player', {
      level: 1,
      strength: 16,
      strengthMod: 3,
      dexterity: 14,
      dexterityMod: 2,
      constitution: 14,
      constitutionMod: 2,
      intelligence: 10,
      intelligenceMod: 0,
      wisdom: 12,
      wisdomMod: 1,
      charisma: 10,
      charismaMod: 0,
      proficiencyBonus: 2,
      armorClass: 14,
      ac: 14,
      maxHitPoints: 12,
      currentHitPoints: 12,
      speed: 30,
      initiativeBonus: 2,
      passivePerception: 11,
      longswordAttackBonus: 5,
      longswordDamageBonus: 3,
      longswordDamageDice: '1d8',
      longswordVersatileDamageDice: '1d10',
      longswordDamageType: 'slashing',
    }, 'dnd-basic-player-v1');
    mergeTemplateComponent(database, 'player', 'status', {
      state: 'healthy',
      label: '健康',
      description: '玩家状态良好，可以正常行动。',
      canAct: true,
    });
    mergeTemplateInventory(database, 'player', {
      items: ['item_longsword'],
      equippedWeaponId: 'item_longsword',
    });
    mergeTemplateComponent(database, 'item_longsword', 'identity', {
      role: 'weapon',
      description: '一把有些旧但保养良好的长剑，适合进行基础近战攻击判定。',
      weaponCategory: 'martial melee weapon',
      damageDice: '1d8',
      versatileDamageDice: '1d10',
      damageType: 'slashing',
      attackAbility: 'strength',
      proficient: true,
    });
    upsertTemplateRelationship(database, 'player', 'item_longsword', 'ownership', null, {
      source: 'baseline',
      summary: '玩家随身携带一把旧长剑。',
    });

    mergeTemplateStats(database, 'character_lina', {
      level: 2,
      strength: 10,
      strengthMod: 0,
      dexterity: 14,
      dexterityMod: 2,
      constitution: 11,
      constitutionMod: 0,
      intelligence: 12,
      intelligenceMod: 1,
      wisdom: 14,
      wisdomMod: 2,
      charisma: 15,
      charismaMod: 2,
      proficiencyBonus: 2,
      armorClass: 12,
      maxHitPoints: 9,
      currentHitPoints: 9,
      speed: 30,
      initiativeBonus: 2,
      passivePerception: 14,
      insightBonus: 4,
      persuasionBonus: 4,
    }, 'dnd-basic-npc-lina-v1');
    database.exec('COMMIT;');
  } catch (error) {
    try {
      database.exec('ROLLBACK;');
    } catch {
      // Preserve the original template update error.
    }
    throw error;
  } finally {
    database.close();
  }
}

export function resetSaveToTemplate() {
  if (!existsSync(TEMPLATE_DB_FILE)) {
    throw new Error('Template database does not exist.');
  }

  copyDirectoryContents(TEMPLATE_CONTEXT_DIR, SAVE_CONTEXT_DIR, { clear: true });
  syncGeneratedWorldSchemaContext(SAVE_CONTEXT_DIR);
  copyDirectoryContents(TEMPLATE_RULES_DIR, SAVE_RULES_DIR, { clear: true });
}

export function createSaveExportBundle(mode) {
  const exportMode = mode === 'full' ? 'full' : 'template';
  syncGeneratedWorldSchemaContext(TEMPLATE_CONTEXT_DIR);
  syncGeneratedWorldSchemaContext(SAVE_CONTEXT_DIR);

  const bundle = {
    version: 1,
    mode: exportMode,
    createdAt: new Date().toISOString(),
    template: {
      worldDbBase64: readDbBase64(TEMPLATE_DB_FILE),
      contextFiles: readContextFiles(TEMPLATE_CONTEXT_DIR),
      ruleFiles: readPackFiles(TEMPLATE_RULES_DIR),
    },
  };

  if (exportMode === 'full') {
    bundle.save = {
      worldDbBase64: readDbBase64(SAVE_DB_FILE),
      contextFiles: readContextFiles(SAVE_CONTEXT_DIR),
      ruleFiles: readPackFiles(SAVE_RULES_DIR),
      conversations: null,
    };
  }

  return bundle;
}

export function importSaveBundle(bundle) {
  if (!bundle || bundle.version !== 1 || !bundle.template) {
    throw new Error('Invalid NewChat save bundle.');
  }

  const savePart = bundle.save ?? bundle.template;
  const templateRuleFiles = Array.isArray(bundle.template.ruleFiles)
    ? bundle.template.ruleFiles
    : readPackFiles(FACTORY_RULES_DIR);
  const saveRuleFiles = Array.isArray(savePart.ruleFiles) ? savePart.ruleFiles : templateRuleFiles;

  writeDbBase64(TEMPLATE_DB_FILE, bundle.template.worldDbBase64);
  writeContextFiles(TEMPLATE_CONTEXT_DIR, bundle.template.contextFiles);
  syncSystemContextFiles(FACTORY_CONTEXT_DIR, TEMPLATE_CONTEXT_DIR);
  syncGeneratedWorldSchemaContext(TEMPLATE_CONTEXT_DIR);
  writePackFiles(TEMPLATE_RULES_DIR, templateRuleFiles);

  writeDbBase64(SAVE_IMPORT_DB_FILE, savePart.worldDbBase64);
  writeContextFiles(SAVE_CONTEXT_DIR, savePart.contextFiles);
  syncSystemContextFiles(TEMPLATE_CONTEXT_DIR, SAVE_CONTEXT_DIR);
  syncGeneratedWorldSchemaContext(SAVE_CONTEXT_DIR);
  writePackFiles(SAVE_RULES_DIR, saveRuleFiles);

  return {
    conversations: Array.isArray(savePart.conversations) ? savePart.conversations : null,
    saveDbFile: SAVE_IMPORT_DB_FILE,
  };
}

export function syncGeneratedWorldSchemaContext(contextDir = SAVE_CONTEXT_DIR) {
  mkdirSync(contextDir, { recursive: true });
  const filePath = join(contextDir, GENERATED_SCHEMA_CONTEXT_FILE_NAME);
  const nextContent = `${formatGeneratedWorldSchemaContext()}\n`;

  if (!existsSync(filePath) || readFileSync(filePath, 'utf8') !== nextContent) {
    writeFileSync(filePath, nextContent, 'utf8');
  }
}

function formatGeneratedWorldSchemaContext() {
  const schemas = listWorldSchemas();
  return [
    '# 世界数据库结构说明（自动生成）',
    '',
    '这个文档由后端根据当前代码里的世界数据库 schema 自动生成，用来告诉世界 Agent 可以使用哪些实体、组件和关系类型。',
    '',
    '## Entity Kinds',
    '',
    ...schemas.entityKinds.map((kind) => `- \`${kind}\``),
    '',
    '## Component Types',
    '',
    ...schemas.componentTypes.map((type) => `- \`${type}\``),
    '',
    '## Component Shape Notes',
    '',
    '- `identity`：常用字段 `role`、`description`、`background`、`personality`、`notes`，也可以附加 race、gender、age 等描述字段。',
    '- `scene`：需要 `description`；可选 `exits`、`tags`、`visibility`。',
    '- `stats`：键值表，值只能是 number、string、boolean 或 null，例如 `maxHitPoints`、`currentHitPoints`、`armorClass`、`strengthMod`。',
    '- `status`：标准字段为 `state`、`label`、`description`、`canAct`。创建能行动的普通角色时使用 `{"state":"active","label":"正常","description":"该角色状态正常，可以行动。","canAct":true}`。后端也兼容 `alive`、`conscious`、`conditions` 并会自动归一化。',
    '- `inventory`：至少使用 `items` 字符串数组；可以附加 `gold`、`equippedWeaponId` 等字段。',
    '- `quest`：需要 `status`、`title`；可选 `description`、`objectives`、`participants`。',
    '- `memory` 使用 `entries` 数组；`schedule` 使用 `entries` 数组。',
    '',
    '## Relationship Types',
    '',
    ...schemas.relationshipTypes.map((type) => `- \`${type}\``),
    '',
    '## 使用规则',
    '',
    '- 查询和修改世界数据时，只能使用以上列出的类型。',
    '- 如果需要新增长期事实，优先复用已有实体、组件和关系类型。',
    '- 不要编造 schema 中不存在的类型；如果现有类型不足以表达，应在回复中说明限制，而不是直接写入未知类型。',
    '',
    '> 注意：这个 Markdown 只是写给模型看的说明；真实数据库校验和工具白名单仍然由后端代码控制。',
  ].join('\n');
}

function isMissingOrEmptyDirectory(dirPath) {
  if (!existsSync(dirPath)) {
    return true;
  }

  return readdirSync(dirPath).length === 0;
}

function hasWorldDbSchema(filePath) {
  if (!existsSync(filePath)) {
    return false;
  }

  let database = null;
  try {
    database = new DatabaseSync(filePath);
    const row = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'entities'").get();
    return Boolean(row);
  } catch {
    return false;
  } finally {
    database?.close();
  }
}

function upsertTemplateEntity(database, id, kind, name) {
  const time = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO entities (id, kind, name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, name = excluded.name, updated_at = excluded.updated_at`,
    )
    .run(id, kind, name, time, time);
}

function setTemplateAliases(database, entityId, aliases) {
  database.prepare('DELETE FROM entity_aliases WHERE entity_id = ?').run(entityId);
  const insert = database.prepare('INSERT INTO entity_aliases (entity_id, alias) VALUES (?, ?)');
  for (const alias of aliases) {
    insert.run(entityId, alias);
  }
}

function mergeTemplateComponent(database, entityId, type, defaults) {
  if (!templateEntityExists(database, entityId)) {
    return;
  }

  const current = readTemplateComponent(database, entityId, type);
  const next = { ...current };
  let changed = false;
  for (const [key, value] of Object.entries(defaults)) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) {
      next[key] = value;
      changed = true;
    }
  }

  if (changed) {
    writeTemplateComponent(database, entityId, type, next);
  }
}

function mergeTemplateStats(database, entityId, defaults, profileId) {
  if (!templateEntityExists(database, entityId)) {
    return;
  }

  const current = readTemplateComponent(database, entityId, 'stats');
  const next = current.rulesProfile === profileId ? { ...current } : { ...current, ...defaults, rulesProfile: profileId };
  let changed = current.rulesProfile !== profileId;

  if (!changed) {
    for (const [key, value] of Object.entries(defaults)) {
      if (!Object.prototype.hasOwnProperty.call(next, key)) {
        next[key] = value;
        changed = true;
      }
    }
  }

  if (changed) {
    writeTemplateComponent(database, entityId, 'stats', next);
  }
}

function mergeTemplateInventory(database, entityId, defaults) {
  if (!templateEntityExists(database, entityId)) {
    return;
  }

  const current = readTemplateComponent(database, entityId, 'inventory');
  const currentItems = Array.isArray(current.items) ? current.items : [];
  const defaultItems = Array.isArray(defaults.items) ? defaults.items : [];
  const items = [...new Set([...currentItems, ...defaultItems])];
  const next = { ...current, items };
  let changed = items.length !== currentItems.length;

  for (const [key, value] of Object.entries(defaults)) {
    if (key !== 'items' && !Object.prototype.hasOwnProperty.call(next, key)) {
      next[key] = value;
      changed = true;
    }
  }

  if (changed) {
    writeTemplateComponent(database, entityId, 'inventory', next);
  }
}

function upsertTemplateRelationship(database, sourceEntityId, targetEntityId, type, value, data) {
  if (!templateEntityExists(database, sourceEntityId) || !templateEntityExists(database, targetEntityId)) {
    return;
  }

  const time = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO relationships (source_entity_id, target_entity_id, type, value, data_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(source_entity_id, target_entity_id, type)
       DO UPDATE SET value = excluded.value, data_json = excluded.data_json, updated_at = excluded.updated_at`,
    )
    .run(sourceEntityId, targetEntityId, type, value, JSON.stringify(data), time, time);
}

function templateEntityExists(database, entityId) {
  return Boolean(database.prepare('SELECT id FROM entities WHERE id = ?').get(entityId));
}

function readTemplateComponent(database, entityId, type) {
  const row = database.prepare('SELECT data_json FROM components WHERE entity_id = ? AND type = ?').get(entityId, type);
  return row ? JSON.parse(row.data_json) : {};
}

function writeTemplateComponent(database, entityId, type, data) {
  const time = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO components (entity_id, type, data_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(entity_id, type) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`,
    )
    .run(entityId, type, JSON.stringify(data), time);
}

function copyDirectoryContents(sourceDir, targetDir, options = {}) {
  if (options.clear) {
    rmSync(targetDir, { recursive: true, force: true });
  }

  mkdirSync(targetDir, { recursive: true });

  if (!existsSync(sourceDir)) {
    return;
  }

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath);
    } else if (entry.isFile()) {
      mkdirSync(dirname(targetPath), { recursive: true });
      copyFileSync(sourcePath, targetPath);
    }
  }
}

function copyMissingDirectoryFiles(sourceDir, targetDir) {
  if (!existsSync(sourceDir)) {
    return;
  }

  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyMissingDirectoryFiles(sourcePath, targetPath);
    } else if (entry.isFile() && !existsSync(targetPath)) {
      mkdirSync(dirname(targetPath), { recursive: true });
      copyFileSync(sourcePath, targetPath);
    }
  }
}

function syncSystemContextFiles(sourceDir, targetDir) {
  if (!existsSync(sourceDir)) {
    return;
  }

  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      syncSystemContextFiles(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile() || isPreservedContextFile(entry.name)) {
      continue;
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }
}

function isPreservedContextFile(name) {
  return name === USER_CONTEXT_FILE_NAME || name === GENERATED_SCHEMA_CONTEXT_FILE_NAME;
}

function copySqliteFamily(sourceFile, targetFile) {
  mkdirSync(dirname(targetFile), { recursive: true });
  removeSqliteFamily(targetFile);

  for (const suffix of SQLITE_COMPANION_SUFFIXES) {
    const sourcePath = `${sourceFile}${suffix}`;
    const targetPath = `${targetFile}${suffix}`;
    if (existsSync(sourcePath)) {
      copyFileSync(sourcePath, targetPath);
    }
  }
}

function removeSqliteFamily(filePath) {
  for (const suffix of SQLITE_COMPANION_SUFFIXES) {
    rmSync(`${filePath}${suffix}`, { force: true });
  }
}

function readDbBase64(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Database file does not exist: ${filePath}`);
  }

  return readFileSync(filePath).toString('base64');
}

function writeDbBase64(filePath, base64) {
  if (typeof base64 !== 'string' || base64.length === 0) {
    throw new Error('Save bundle is missing a database payload.');
  }

  mkdirSync(dirname(filePath), { recursive: true });
  removeSqliteFamily(filePath);
  writeFileSync(filePath, Buffer.from(base64, 'base64'));
}

function readContextFiles(contextDir) {
  if (!existsSync(contextDir)) {
    return [];
  }

  return readdirSync(contextDir)
    .filter((name) => isSafeContextFileName(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => {
      const filePath = join(contextDir, name);
      const stats = statSync(filePath);
      return {
        name,
        content: stats.isFile() ? readFileSync(filePath, 'utf8') : '',
      };
    });
}

function readPackFiles(rootDir) {
  if (!existsSync(rootDir)) {
    return [];
  }

  const files = [];
  collectPackFiles(rootDir, rootDir, files);
  return files.sort((left, right) => left.path.localeCompare(right.path, undefined, { numeric: true }));
}

function collectPackFiles(rootDir, currentDir, files) {
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    const filePath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectPackFiles(rootDir, filePath, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const relativePath = filePath.slice(rootDir.length + 1).replace(/\\/g, '/');
    if (!isSafePackFilePath(relativePath)) {
      continue;
    }
    files.push({
      path: relativePath,
      content: readFileSync(filePath, 'utf8'),
    });
  }
}

function writeContextFiles(contextDir, files) {
  if (!Array.isArray(files)) {
    throw new Error('Save bundle is missing context files.');
  }

  rmSync(contextDir, { recursive: true, force: true });
  mkdirSync(contextDir, { recursive: true });

  for (const file of files) {
    if (!file || !isSafeContextFileName(file.name)) {
      continue;
    }

    writeFileSync(join(contextDir, basename(file.name)), String(file.content ?? ''), 'utf8');
  }
}

function writePackFiles(rootDir, files) {
  if (!Array.isArray(files)) {
    throw new Error('Save bundle is missing rule files.');
  }

  rmSync(rootDir, { recursive: true, force: true });
  mkdirSync(rootDir, { recursive: true });

  for (const file of files) {
    const path = typeof file?.path === 'string' ? file.path.replace(/\\/g, '/') : '';
    if (!isSafePackFilePath(path)) {
      continue;
    }
    const targetPath = join(rootDir, ...path.split('/'));
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, String(file.content ?? ''), 'utf8');
  }
}

function isSafeContextFileName(name) {
  return typeof name === 'string' && basename(name) === name && name.endsWith('.md');
}

function isSafePackFilePath(path) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes(':')) {
    return false;
  }

  const parts = path.split('/');
  return parts.every(Boolean) && !parts.includes('..') && (path.endsWith('.md') || path.endsWith('.json'));
}

ensureDataLayout();
