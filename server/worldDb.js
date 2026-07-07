import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SAVE_DB_FILE } from './saveManager.js';
import {
  ensureSevenDayCrownPlayableState,
  getSevenDayCrownPlayerStats,
  seedSevenDayCrownWorld,
} from './defaultWorld.js';
import {
  isEntityKind,
  validateComponentData,
  validateRelationshipInput,
} from './worldSchemas.js';
import { createWorldDbSchema } from './worldDbSchema.js';

function openWorldDatabase() {
  mkdirSync(dirname(SAVE_DB_FILE), { recursive: true });
  const database = new DatabaseSync(SAVE_DB_FILE);
  database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return database;
}

export let db = openWorldDatabase();

export function checkpointWorldDb() {
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
}

export function closeWorldDb() {
  db.close();
}

export function reopenWorldDb() {
  db = openWorldDatabase();
}

export function restoreWorldDbFromFile(sourceFile) {
  if (!existsSync(sourceFile)) {
    throw new Error(`Restore source database does not exist: ${sourceFile}`);
  }

  const sourceLiteral = sourceFile.replace(/'/g, "''");
  const attachName = 'restore_source';
  const deleteOrder = [
    'agent_steps',
    'agent_runs',
    'conversations',
    'events',
    'relationships',
    'components',
    'entity_aliases',
    'entity_search_fts',
    'entities',
    'meta',
  ];
  const copyOrder = [
    'meta',
    'entities',
    'entity_aliases',
    'components',
    'relationships',
    'events',
    'conversations',
    'agent_runs',
    'agent_steps',
  ];

  db.exec(`ATTACH DATABASE '${sourceLiteral}' AS ${attachName};`);
  try {
    const sourceTables = new Set(
      db.prepare(`SELECT name FROM ${attachName}.sqlite_master WHERE type = 'table'`).all().map((row) => row.name),
    );
    if (!sourceTables.has('entities')) {
      throw new Error('Restore source database is not a valid NewChat world database.');
    }

    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec('BEGIN;');
    for (const tableName of deleteOrder) {
      db.exec(`DELETE FROM ${tableName};`);
    }
    db.exec('DELETE FROM sqlite_sequence;');
    for (const tableName of copyOrder) {
      if (!sourceTables.has(tableName)) {
        continue;
      }
      db.exec(`INSERT INTO ${tableName} SELECT * FROM ${attachName}.${tableName};`);
    }
    if (sourceTables.has('sqlite_sequence')) {
      db.exec(`INSERT INTO sqlite_sequence SELECT * FROM ${attachName}.sqlite_sequence;`);
    }
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // Preserve the original restore error.
    }
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(`DETACH DATABASE ${attachName};`);
  }
}

let transactionDepth = 0;

export function withTransaction(callback) {
  if (transactionDepth > 0) return callback();
  transactionDepth += 1;
  db.exec('BEGIN');
  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    transactionDepth -= 1;
  }
}

export function migrateWorldDb() {
  createWorldDbSchema(db);
}

export function seedWorldIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS count FROM entities').get();
  if (Number(row.count) > 0) return;

  withTransaction(() => {
    seedSevenDayCrownWorld({
      upsertEntity,
      setAliases,
      upsertComponent,
      upsertRelationship,
      setMeta,
      addEvent,
    });
  });
}

export function ensurePlayableCharacterStats() {
  withTransaction(() => {
    ensureSevenDayCrownPlayableState({
      getEntity,
      upsertEntity,
      setAliases,
      mergeComponentDefaults,
      applyStatsProfile,
      mergeInventoryDefaults,
      upsertRelationship,
    });
  });
}

function getDefaultPlayerStats() {
  return getSevenDayCrownPlayerStats();
}

function applyStatsProfile(entityId, defaults, profileId, preserveKeys = []) {
  const current = getComponent(entityId, 'stats') || {};
  const shouldNormalize = current.rulesProfile !== profileId;
  const next = shouldNormalize ? { ...current, ...defaults, rulesProfile: profileId } : { ...current };
  let changed = shouldNormalize;

  for (const key of preserveKeys) {
    if (Object.prototype.hasOwnProperty.call(current, key)) {
      next[key] = current[key];
    }
  }

  if (!shouldNormalize) {
    for (const [key, value] of Object.entries(defaults)) {
      if (!Object.prototype.hasOwnProperty.call(next, key)) {
        next[key] = value;
        changed = true;
      }
    }
  }

  if (changed) {
    upsertComponent(entityId, 'stats', next);
  }
}

function mergeComponentDefaults(entityId, type, defaults) {
  const current = getComponent(entityId, type) || {};
  const next = { ...current };
  let changed = false;

  for (const [key, value] of Object.entries(defaults)) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) {
      next[key] = value;
      changed = true;
    }
  }

  if (changed) {
    upsertComponent(entityId, type, next);
  }
}

function mergeInventoryDefaults(entityId, defaults) {
  const current = getComponent(entityId, 'inventory') || {};
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
    upsertComponent(entityId, 'inventory', next);
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function setMeta(key, value) {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function getMeta(key, fallback = '') {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row?.value ?? fallback;
}

export function upsertEntity(id, kind, name) {
  if (!id || !kind || !name) throw new Error('entity 需要 id、kind、name。');
  if (!isEntityKind(kind)) throw new Error(`未知 EntityKind：${kind}`);
  const time = nowIso();
  db.prepare(`
    INSERT INTO entities (id, kind, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, name = excluded.name, updated_at = excluded.updated_at
  `).run(id, kind, name, time, time);
  refreshEntitySearch(id);
}

export function deleteEntity(id) {
  db.prepare('DELETE FROM entities WHERE id = ?').run(id);
  db.prepare('DELETE FROM entity_search_fts WHERE entity_id = ?').run(id);
}

export function getEntity(id) {
  return db.prepare('SELECT id, kind, name, created_at as createdAt, updated_at as updatedAt FROM entities WHERE id = ?').get(id) ?? null;
}

export function listEntities(options = {}) {
  const kind = typeof options.kind === 'string' && options.kind ? options.kind : null;
  if (kind) {
    return db.prepare('SELECT id, kind, name, created_at as createdAt, updated_at as updatedAt FROM entities WHERE kind = ? ORDER BY updated_at DESC').all(kind);
  }
  return db.prepare('SELECT id, kind, name, created_at as createdAt, updated_at as updatedAt FROM entities ORDER BY updated_at DESC').all();
}

export function upsertComponent(entityId, type, data) {
  if (!getEntity(entityId)) throw new Error(`实体 ${entityId} 不存在。`);
  const validation = validateComponentData(type, data);
  if (!validation.ok) throw new Error(validation.error);
  db.prepare(`
    INSERT INTO components (entity_id, type, data_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(entity_id, type) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at
  `).run(entityId, type, JSON.stringify(validation.data), nowIso());
  refreshEntitySearch(entityId);
  return validation.data;
}

export function getComponent(entityId, type) {
  const row = db.prepare('SELECT data_json FROM components WHERE entity_id = ? AND type = ?').get(entityId, type);
  return row ? JSON.parse(row.data_json) : null;
}

export function deleteComponent(entityId, type) {
  db.prepare('DELETE FROM components WHERE entity_id = ? AND type = ?').run(entityId, type);
  refreshEntitySearch(entityId);
}

export function listComponents(entityId = null) {
  const rows = entityId
    ? db.prepare('SELECT entity_id as entityId, type, data_json as dataJson, updated_at as updatedAt FROM components WHERE entity_id = ? ORDER BY type').all(entityId)
    : db.prepare('SELECT entity_id as entityId, type, data_json as dataJson, updated_at as updatedAt FROM components ORDER BY entity_id, type').all();
  return rows.map((row) => ({
    entityId: row.entityId,
    type: row.type,
    data: JSON.parse(row.dataJson),
    updatedAt: row.updatedAt,
  }));
}

export function upsertRelationship(sourceEntityId, targetEntityId, type, value = null, data = {}) {
  if (!getEntity(sourceEntityId)) throw new Error(`源实体 ${sourceEntityId} 不存在。`);
  if (!getEntity(targetEntityId)) throw new Error(`目标实体 ${targetEntityId} 不存在。`);
  const validation = validateRelationshipInput(type, value, data);
  if (!validation.ok) throw new Error(validation.error);
  const time = nowIso();
  db.prepare(`
    INSERT INTO relationships (source_entity_id, target_entity_id, type, value, data_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_entity_id, target_entity_id, type) DO UPDATE SET
      value = excluded.value,
      data_json = excluded.data_json,
      updated_at = excluded.updated_at
  `).run(sourceEntityId, targetEntityId, type, validation.value, JSON.stringify(validation.data), time, time);
  refreshEntitySearch(sourceEntityId);
  refreshEntitySearch(targetEntityId);
}

export function deleteRelationship(sourceEntityId, targetEntityId, type) {
  db.prepare('DELETE FROM relationships WHERE source_entity_id = ? AND target_entity_id = ? AND type = ?').run(sourceEntityId, targetEntityId, type);
  refreshEntitySearch(sourceEntityId);
  refreshEntitySearch(targetEntityId);
}

export function listRelationships(options = {}) {
  const { entityId, direction = 'both', type } = options;
  const rows = db.prepare(`
    SELECT id, source_entity_id as sourceEntityId, target_entity_id as targetEntityId, type, value, data_json as dataJson, created_at as createdAt, updated_at as updatedAt
    FROM relationships
    WHERE (? IS NULL OR type = ?)
      AND (
        ? IS NULL OR
        (? = 'out' AND source_entity_id = ?) OR
        (? = 'in' AND target_entity_id = ?) OR
        (? = 'both' AND (source_entity_id = ? OR target_entity_id = ?))
      )
    ORDER BY updated_at DESC, id DESC
  `).all(type ?? null, type ?? null, entityId ?? null, direction, entityId ?? '', direction, entityId ?? '', direction, entityId ?? '', entityId ?? '');
  return rows.map(parseRelationshipRow);
}

export function setAliases(entityId, aliases) {
  if (!getEntity(entityId)) throw new Error(`实体 ${entityId} 不存在。`);
  db.prepare('DELETE FROM entity_aliases WHERE entity_id = ?').run(entityId);
  const stmt = db.prepare('INSERT OR IGNORE INTO entity_aliases (entity_id, alias) VALUES (?, ?)');
  for (const alias of aliases.filter((item) => typeof item === 'string' && item.trim())) {
    stmt.run(entityId, alias.trim());
  }
  refreshEntitySearch(entityId);
}

export function listAliases(entityId) {
  return db.prepare('SELECT alias FROM entity_aliases WHERE entity_id = ? ORDER BY alias').all(entityId).map((row) => row.alias);
}

export function addEvent(type, actorId, targetId, payload = {}) {
  const result = db.prepare('INSERT INTO events (type, actor_id, target_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)').run(
    type,
    actorId ?? null,
    targetId ?? null,
    JSON.stringify(payload),
    nowIso(),
  );
  return { id: Number(result.lastInsertRowid) };
}

export function listEvents(limit = 40, entityId = null) {
  const rows = entityId
    ? db.prepare(`
      SELECT id, type, actor_id as actorId, target_id as targetId, payload_json as payloadJson, created_at as createdAt
      FROM events
      WHERE actor_id = ? OR target_id = ?
      ORDER BY id DESC LIMIT ?
    `).all(entityId, entityId, limit)
    : db.prepare('SELECT id, type, actor_id as actorId, target_id as targetId, payload_json as payloadJson, created_at as createdAt FROM events ORDER BY id DESC LIMIT ?').all(limit);
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    actorId: row.actorId,
    targetId: row.targetId,
    payload: JSON.parse(row.payloadJson),
    createdAt: row.createdAt,
  })).reverse();
}

export function addConversation(role, speakerId, speakerName, content) {
  db.prepare('INSERT INTO conversations (speaker_id, speaker_name, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
    speakerId ?? null,
    speakerName,
    role,
    content,
    nowIso(),
  );
}

export function listWorldConversations(limit = 40) {
  return db.prepare('SELECT id, speaker_id as speakerId, speaker_name as speakerName, role, content, created_at as createdAt FROM conversations ORDER BY id DESC LIMIT ?').all(limit).reverse();
}

export function createAgentRun(prompt) {
  const time = nowIso();
  const result = db.prepare('INSERT INTO agent_runs (prompt, status, answer, error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    prompt,
    'running',
    null,
    null,
    time,
    time,
  );
  return Number(result.lastInsertRowid);
}

export function finishAgentRun(id, status, answer = null, error = null) {
  db.prepare('UPDATE agent_runs SET status = ?, answer = ?, error = ?, updated_at = ? WHERE id = ?').run(status, answer, error, nowIso(), id);
}

export function addAgentStep(runId, index, tool, args, result) {
  db.prepare('INSERT INTO agent_steps (run_id, step_index, tool, args_json, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    runId,
    index,
    tool,
    JSON.stringify(args),
    JSON.stringify(result),
    nowIso(),
  );
}

export function listAgentRuns(limit = 10) {
  return db.prepare('SELECT id, prompt, status, answer, error, created_at as createdAt, updated_at as updatedAt FROM agent_runs ORDER BY id DESC LIMIT ?').all(limit);
}

export function listAgentSteps(runId) {
  return db.prepare('SELECT id, run_id as runId, step_index as stepIndex, tool, args_json as argsJson, result_json as resultJson, created_at as createdAt FROM agent_steps WHERE run_id = ? ORDER BY step_index').all(runId).map((row) => ({
    id: row.id,
    runId: row.runId,
    stepIndex: row.stepIndex,
    tool: row.tool,
    args: JSON.parse(row.argsJson),
    result: JSON.parse(row.resultJson),
    createdAt: row.createdAt,
  }));
}

export function searchEntities({ query = '', kind = '', sceneId = '', limit = 12 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 40);
  const trimmed = String(query || '').trim();
  const indexedMatchIds = trimmed ? getSearchIndexMatches(trimmed, safeLimit * 4) : [];
  const params = [];
  let sql = `
    SELECT DISTINCT e.id, e.kind, e.name, e.created_at as createdAt, e.updated_at as updatedAt
    FROM entities e
    LEFT JOIN entity_aliases a ON a.entity_id = e.id
  `;
  if (sceneId) {
    sql += " INNER JOIN relationships loc ON loc.source_entity_id = e.id AND loc.type = 'located_in' AND loc.target_entity_id = ? ";
    params.push(sceneId);
  }
  const clauses = [];
  if (kind) {
    clauses.push('e.kind = ?');
    params.push(kind);
  }
  if (trimmed) {
    const placeholders = indexedMatchIds.map(() => '?').join(', ');
    clauses.push(
      ['e.id LIKE ?', 'e.name LIKE ?', 'a.alias LIKE ?', placeholders ? `e.id IN (${placeholders})` : '0'].join(' OR '),
    );
    params.push(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`, ...indexedMatchIds);
  }
  if (clauses.length) {
    sql += ` WHERE ${clauses.join(' AND ')}`;
  }
  if (trimmed) {
    sql += `
      ORDER BY
        CASE
          WHEN e.id = ? THEN 0
          WHEN e.name = ? THEN 1
          WHEN a.alias = ? THEN 2
          WHEN e.name LIKE ? THEN 3
          WHEN a.alias LIKE ? THEN 4
          ELSE 5
        END,
        e.updated_at DESC
      LIMIT ?
    `;
    params.push(trimmed, trimmed, trimmed, `%${trimmed}%`, `%${trimmed}%`, safeLimit);
  } else {
    sql += ' ORDER BY e.updated_at DESC LIMIT ?';
    params.push(safeLimit);
  }
  return db.prepare(sql).all(...params).map((entity) => ({
    ...entity,
    aliases: listAliases(entity.id),
    locationId: getCurrentLocationId(entity.id),
  }));
}

function getSearchIndexMatches(query, limit) {
  const like = `%${query}%`;
  const ids = new Set(
    db
      .prepare('SELECT entity_id FROM entity_search_fts WHERE name LIKE ? OR aliases LIKE ? OR body LIKE ? LIMIT ?')
      .all(like, like, like, limit)
      .map((row) => row.entity_id),
  );

  try {
    for (const row of db
      .prepare('SELECT entity_id FROM entity_search_fts WHERE entity_search_fts MATCH ? LIMIT ?')
      .all(escapeFtsQuery(query), limit)) {
      ids.add(row.entity_id);
    }
  } catch {
    // FTS tokenizers can reject some Chinese or punctuation-heavy queries; LIKE remains the compatibility fallback.
  }

  return Array.from(ids);
}

export function getEntityBundle(entityId) {
  const entity = getEntity(entityId);
  if (!entity) return null;
  return {
    entity,
    aliases: listAliases(entity.id),
    components: Object.fromEntries(listComponents(entity.id).map((component) => [component.type, component.data])),
    relationships: listRelationships({ entityId: entity.id }),
    events: listEntityWorldEvents(entity.id, 12),
  };
}

function listEntityWorldEvents(entityId, limit = 12) {
  const safeLimit = Math.max(1, Number(limit) || 12);
  const rows = db.prepare(`
      SELECT id, type, actor_id as actorId, target_id as targetId, payload_json as payloadJson, created_at as createdAt
      FROM events
      WHERE (actor_id = ? OR target_id = ?) AND type NOT LIKE 'agent.%'
      ORDER BY id DESC LIMIT ?
    `).all(entityId, entityId, safeLimit);
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    actorId: row.actorId,
    targetId: row.targetId,
    payload: JSON.parse(row.payloadJson),
    createdAt: row.createdAt,
  })).reverse();
}

export function getCurrentLocationId(entityId) {
  return listRelationships({ entityId, direction: 'out', type: 'located_in' })[0]?.targetEntityId ?? null;
}

export function setCurrentLocation(entityId, sceneId, source = 'world', summary = '') {
  for (const relationship of listRelationships({ entityId, direction: 'out', type: 'located_in' })) {
    if (relationship.targetEntityId !== sceneId) {
      deleteRelationship(relationship.sourceEntityId, relationship.targetEntityId, relationship.type);
    }
  }
  upsertRelationship(entityId, sceneId, 'located_in', null, {
    source,
    summary: summary || `${entityId} 当前位于 ${sceneId}。`,
  });
}

export function getCurrentScene() {
  const playerId = getMeta('playerId', 'player');
  const sceneId = getCurrentLocationId(playerId) || getMeta('currentSceneId', 'scene_ash_chapel');
  const scene = getEntity(sceneId);
  const sceneComponent = scene ? getComponent(scene.id, 'scene') : null;
  const located = listRelationships({ direction: 'in', entityId: sceneId, type: 'located_in' })
    .map((relationship) => getEntity(relationship.sourceEntityId))
    .filter(Boolean);
  const exits = listRelationships({ direction: 'out', entityId: sceneId, type: 'exit_to' })
    .map((relationship) => ({
      relationship,
      scene: getEntity(relationship.targetEntityId),
    }))
    .filter((item) => item.scene);
  return {
    playerId,
    scene,
    sceneComponent,
    residents: located.filter((entity) => entity.kind === 'character'),
    items: located.filter((entity) => entity.kind === 'item'),
    events: located.filter((entity) => entity.kind === 'event'),
    exits,
    relatedLore: listRelationships({ direction: 'out', entityId: sceneId, type: 'mentions' })
      .map((relationship) => getEntity(relationship.targetEntityId))
      .filter(Boolean),
  };
}

export function getWorldMap() {
  const currentScene = getCurrentScene();
  const scenes = listEntities({ kind: 'scene' }).map((scene) => {
    const sceneComponent = getComponent(scene.id, 'scene') || {};
    return {
      id: scene.id,
      name: scene.name,
      description: typeof sceneComponent.description === 'string' ? sceneComponent.description : '',
      tags: Array.isArray(sceneComponent.tags) ? sceneComponent.tags.filter((tag) => typeof tag === 'string') : [],
    };
  });
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const links = listRelationships({ type: 'exit_to' })
    .filter((relationship) => sceneIds.has(relationship.sourceEntityId) && sceneIds.has(relationship.targetEntityId))
    .map((relationship) => ({
      sourceSceneId: relationship.sourceEntityId,
      targetSceneId: relationship.targetEntityId,
    }));

  return {
    currentSceneId: currentScene.scene?.id || '',
    scenes,
    links,
  };
}

export function enterScene(sceneId) {
  const playerId = getMeta('playerId', 'player');
  const currentSceneId = getCurrentLocationId(playerId);
  const target = getEntity(sceneId);
  if (!target || target.kind !== 'scene') {
    throw new Error(`场景 ${sceneId} 不存在。`);
  }
  if (currentSceneId && currentSceneId !== sceneId) {
    const exit = listRelationships({ entityId: currentSceneId, direction: 'out', type: 'exit_to' })
      .find((relationship) => relationship.targetEntityId === sceneId);
    if (!exit) {
      throw new Error(`当前场景不能直接前往 ${target.name}。`);
    }
  }
  setCurrentLocation(playerId, sceneId, 'enter_scene');
  setMeta('currentSceneId', sceneId);
  addEvent('scene.entered', playerId, sceneId, { summary: `玩家进入 ${target.name}。` });
  return getCurrentScene();
}

export function getWorldOverview() {
  const entities = listEntities();
  return {
    currentScene: getCurrentScene(),
    counts: {
      entities: entities.length,
      scenes: entities.filter((entity) => entity.kind === 'scene').length,
      characters: entities.filter((entity) => entity.kind === 'character').length,
      items: entities.filter((entity) => entity.kind === 'item').length,
      relationships: listRelationships().length,
    },
    recentAgentRuns: listAgentRuns(5),
  };
}

export function applyWorldPatch({ operations = [], confirmedTargetIds = [], dryRun = false, prompt = '' }) {
  if (!Array.isArray(operations) || !operations.length) throw new Error('world patch 需要 operations 数组。');
  if (operations.length > 12) throw new Error('单次最多执行 12 个 operations。');
  const normalizedOperations = operations.map(normalizeWorldPatchOperation).filter(Boolean);
  if (!normalizedOperations.length) throw new Error('world patch 没有可执行的 operation。');
  const confirmed = new Set(Array.isArray(confirmedTargetIds) ? confirmedTargetIds.filter(Boolean) : []);
  const diffs = [];
  const undoOperations = [];
  const applied = [];

  const execute = () => {
    for (const [index, operation] of normalizedOperations.entries()) {
      const result = applyOperation(operation, index, confirmed, prompt);
      applied.push(result.applied);
      diffs.push(result.diff);
      undoOperations.unshift(...result.undoOperations);
    }
  };

  if (dryRun) {
    try {
      withTransaction(() => {
        execute();
        throw new DryRunRollback();
      });
    } catch (error) {
      if (!(error instanceof DryRunRollback)) throw error;
    }
  } else {
    withTransaction(execute);
  }

  return {
    applied,
    diff: diffs,
    undoOperations,
    dryRun,
    summary: `${dryRun ? '预演' : '已执行'} ${applied.length} 个世界数据操作。`,
  };
}

class DryRunRollback extends Error {}

function normalizeWorldPatchOperation(operation) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) return operation;

  const op = firstString(operation.op, operation.operation, operation.type);
  if (['move_entity', 'move_character', 'move_npc'].includes(op)) {
    return normalizeLocationPatchOperation(operation);
  }

  if (op === 'set_location') {
    return normalizeLocationPatchOperation(operation);
  }

  if (op === 'set_relationship') {
    const relationshipType = firstString(operation.relationshipType, operation.relationType, operation.type);
    if (relationshipType === 'located_in') {
      return normalizeLocationPatchOperation(operation);
    }
  }

  if (['replace', 'add', 'set', 'upsert'].includes(op)) {
    return normalizeJsonPatchOperation(operation);
  }

  return operation;
}

function normalizeLocationPatchOperation(operation) {
  return {
    op: 'set_location',
    entityId: firstString(operation.entityId, operation.sourceEntityId, operation.sourceId),
    sceneId: firstString(operation.sceneId, operation.targetSceneId, operation.targetEntityId, operation.targetId, operation.locationId),
    summary: firstString(operation.summary, operation.data?.summary),
  };
}

function normalizeJsonPatchOperation(operation) {
  const path = normalizePath(operation.path);
  const value = operation.value;
  if (path.length === 2 && path[0] === 'relationships' && path[1] === '-' && isRecord(value)) {
    return normalizeWorldPatchOperation({
      op: 'set_relationship',
      sourceEntityId: value.sourceEntityId || value.sourceId || value.source,
      targetEntityId: value.targetEntityId || value.targetId || value.target,
      relationshipType: value.relationshipType || value.relationType || value.type,
      value: value.value,
      data: isRecord(value.data) ? value.data : {},
    });
  }
  return operation;
}

function applyOperation(operation, index, confirmed, prompt) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
    throw new Error(`operation #${index + 1} 必须是对象。`);
  }
  const op = firstString(operation.op, operation.operation, operation.type);
  if (op === 'create_entity') {
    const entityId = firstString(operation.entityId, operation.id);
    const kind = firstString(operation.kind);
    const name = firstString(operation.name);
    if (!entityId || !kind || !name) throw new Error(`operation #${index + 1} create_entity 需要 entityId、kind、name。`);
    if (getEntity(entityId)) throw new Error(`实体 ${entityId} 已存在。`);
    upsertEntity(entityId, kind, name);
    if (operation.aliases && Array.isArray(operation.aliases)) setAliases(entityId, operation.aliases);
    const components = isRecord(operation.components) ? operation.components : {};
    for (const [type, data] of Object.entries(components)) {
      upsertComponent(entityId, type, data);
    }
    const after = getEntityBundle(entityId);
    return {
      applied: { op, entityId, kind, name, summary: `创建实体 ${name}(${entityId})` },
      diff: { op, summary: `创建实体 ${name}(${entityId})`, before: null, after },
      undoOperations: [{ op: 'delete_entity', entityId }],
    };
  }

  if (op === 'create_owned_item') {
    const ownerEntityId = firstString(operation.ownerEntityId, operation.sourceEntityId, operation.ownerId);
    const itemId = firstString(operation.itemId, operation.entityId, operation.id);
    const name = firstString(operation.name, operation.itemName);
    assertConfirmed(confirmed, [ownerEntityId], index, prompt);
    if (!getEntity(ownerEntityId)) throw new Error(`持有者 ${ownerEntityId} 不存在。`);
    if (getEntity(itemId)) throw new Error(`道具 ${itemId} 已存在。`);
    upsertEntity(itemId, 'item', name);
    upsertComponent(itemId, 'identity', {
      role: 'item',
      description: firstString(operation.description, `${name}还没有详细描述。`),
      ...(isRecord(operation.identity) ? operation.identity : {}),
    });
    upsertRelationship(ownerEntityId, itemId, 'ownership', null, {
      source: 'world.patch',
      summary: firstString(operation.summary, `${ownerEntityId} 持有 ${name}。`),
    });
    return {
      applied: { op, ownerEntityId, itemId, name, summary: `创建道具 ${name} 并设置持有关系` },
      diff: { op, summary: `创建道具 ${name} 并设置持有关系`, before: null, after: getEntityBundle(itemId) },
      undoOperations: [{ op: 'delete_entity', entityId: itemId }],
    };
  }

  if (op === 'set_component') {
    const entityId = firstString(operation.entityId, operation.targetEntityId);
    const componentType = firstString(operation.componentType, operation.component);
    assertConfirmed(confirmed, [entityId], index, prompt);
    const before = getComponent(entityId, componentType);
    const path = normalizePath(operation.path);
    const next = path.length ? setAtPath(before ?? {}, path, operation.value) : isRecord(operation.data) ? { ...(before ?? {}), ...operation.data } : operation.value;
    const after = upsertComponent(entityId, componentType, next);
    return {
      applied: { op, entityId, componentType, summary: `设置 ${entityId}.${componentType}${path.length ? `.${path.join('.')}` : ''}` },
      diff: { op, summary: `设置 ${entityId}.${componentType}`, before, after },
      undoOperations: before ? [{ op: 'set_component', entityId, componentType, data: before }] : [{ op: 'delete_component', entityId, componentType }],
    };
  }

  if (op === 'delete_component') {
    const entityId = firstString(operation.entityId, operation.targetEntityId);
    const componentType = firstString(operation.componentType, operation.component);
    assertConfirmed(confirmed, [entityId], index, prompt);
    const before = getComponent(entityId, componentType);
    if (!before) throw new Error(`${entityId} 没有 ${componentType} 组件。`);
    deleteComponent(entityId, componentType);
    return {
      applied: { op, entityId, componentType, summary: `删除 ${entityId}.${componentType}` },
      diff: { op, summary: `删除 ${entityId}.${componentType}`, before, after: null },
      undoOperations: [{ op: 'set_component', entityId, componentType, data: before }],
    };
  }

  if (op === 'set_location') {
    const entityId = firstString(operation.entityId, operation.sourceEntityId, operation.sourceId);
    const sceneId = firstString(operation.sceneId, operation.targetSceneId, operation.targetEntityId, operation.targetId, operation.locationId);
    assertLocationConfirmed(confirmed, [entityId, sceneId], index);
    if (!entityId) throw new Error(`operation #${index + 1} set_location 需要 entityId。`);
    if (!sceneId) throw new Error(`operation #${index + 1} set_location 需要 sceneId。`);
    const entity = getEntity(entityId);
    if (!entity) throw new Error(`实体 ${entityId} 不存在。`);
    const scene = getEntity(sceneId);
    if (!scene) throw new Error(`场景 ${sceneId} 不存在。`);
    if (scene.kind !== 'scene') throw new Error(`${sceneId} 不是场景实体。`);

    const previousSceneId = getCurrentLocationId(entityId);
    const before = getEntityBundle(entityId);
    const summary = firstString(operation.summary, operation.data?.summary, `${entity.name} 当前位于 ${scene.name}。`);
    setCurrentLocation(entityId, sceneId, 'world.patch', summary);
    const after = getEntityBundle(entityId);
    return {
      applied: { op, entityId, sceneId, previousSceneId, summary: `移动 ${entityId} 到 ${sceneId}` },
      diff: { op, summary: `移动 ${entityId} 到 ${sceneId}`, before, after },
      undoOperations: previousSceneId
        ? [{ op: 'set_location', entityId, sceneId: previousSceneId }]
        : [{ op: 'delete_relationship', sourceEntityId: entityId, targetEntityId: sceneId, relationshipType: 'located_in' }],
    };
  }

  if (op === 'set_relationship') {
    const sourceEntityId = firstString(operation.sourceEntityId, operation.sourceId);
    const targetEntityId = firstString(operation.targetEntityId, operation.targetId);
    const relationshipType = firstString(operation.relationshipType, operation.relationType, operation.type);
    assertConfirmed(confirmed, [sourceEntityId, targetEntityId], index, prompt);
    const before = listRelationships({ entityId: sourceEntityId, direction: 'out', type: relationshipType })
      .find((relationship) => relationship.targetEntityId === targetEntityId) ?? null;
    upsertRelationship(sourceEntityId, targetEntityId, relationshipType, operation.value ?? null, isRecord(operation.data) ? operation.data : {});
    const after = listRelationships({ entityId: sourceEntityId, direction: 'out', type: relationshipType })
      .find((relationship) => relationship.targetEntityId === targetEntityId);
    return {
      applied: { op, sourceEntityId, targetEntityId, relationshipType, summary: `设置关系 ${sourceEntityId} -> ${targetEntityId} / ${relationshipType}` },
      diff: { op, summary: `设置关系 ${sourceEntityId} -> ${targetEntityId} / ${relationshipType}`, before, after },
      undoOperations: before
        ? [{ op: 'set_relationship', sourceEntityId, targetEntityId, relationshipType, value: before.value, data: before.data }]
        : [{ op: 'delete_relationship', sourceEntityId, targetEntityId, relationshipType }],
    };
  }

  if (op === 'delete_relationship') {
    const sourceEntityId = firstString(operation.sourceEntityId, operation.sourceId);
    const targetEntityId = firstString(operation.targetEntityId, operation.targetId);
    const relationshipType = firstString(operation.relationshipType, operation.relationType, operation.type);
    assertConfirmed(confirmed, [sourceEntityId, targetEntityId], index, prompt);
    const before = listRelationships({ entityId: sourceEntityId, direction: 'out', type: relationshipType })
      .find((relationship) => relationship.targetEntityId === targetEntityId);
    if (!before) throw new Error('关系不存在。');
    deleteRelationship(sourceEntityId, targetEntityId, relationshipType);
    return {
      applied: { op, sourceEntityId, targetEntityId, relationshipType, summary: `删除关系 ${sourceEntityId} -> ${targetEntityId} / ${relationshipType}` },
      diff: { op, summary: `删除关系 ${sourceEntityId} -> ${targetEntityId} / ${relationshipType}`, before, after: null },
      undoOperations: [{ op: 'set_relationship', sourceEntityId, targetEntityId, relationshipType, value: before.value, data: before.data }],
    };
  }

  if (op === 'delete_entity') {
    const entityId = firstString(operation.entityId, operation.targetEntityId, operation.id);
    assertConfirmed(confirmed, [entityId], index, prompt);
    if (entityId === getMeta('playerId', 'player')) throw new Error('不能删除玩家实体。');
    const before = getEntityBundle(entityId);
    if (!before) throw new Error(`实体 ${entityId} 不存在。`);
    deleteEntity(entityId);
    return {
      applied: { op, entityId, summary: `删除实体 ${entityId}` },
      diff: { op, summary: `删除实体 ${entityId}`, before, after: null },
      undoOperations: buildRestoreEntityOperations(before),
    };
  }

  throw new Error(`未知 operation：${op}`);
}

function buildRestoreEntityOperations(bundle) {
  return [
    {
      op: 'create_entity',
      entityId: bundle.entity.id,
      kind: bundle.entity.kind,
      name: bundle.entity.name,
      aliases: bundle.aliases,
      components: bundle.components,
    },
    ...bundle.relationships.map((relationship) => ({
      op: 'set_relationship',
      sourceEntityId: relationship.sourceEntityId,
      targetEntityId: relationship.targetEntityId,
      relationshipType: relationship.type,
      value: relationship.value,
      data: relationship.data,
    })),
  ];
}

function assertConfirmed(confirmed, ids, index, prompt) {
  const cleanIds = ids.filter(Boolean);
  if (cleanIds.some((id) => confirmed.has(id))) return;
  if (confirmed.size > 0) {
    throw new Error(`operation #${index + 1} 目标不匹配：已确认目标 ${Array.from(confirmed).join(', ')}，本次目标 ${cleanIds.join(', ') || '(empty)'}。`);
  }
  const mentioned = listEntities().filter((entity) => prompt.includes(entity.name) || prompt.includes(entity.id));
  if (!mentioned.length) return;
  if (cleanIds.includes(mentioned[0].id)) return;
  throw new Error(`operation #${index + 1} 目标不匹配：任务提到了 ${mentioned[0].name}(${mentioned[0].id})。`);
}

function assertLocationConfirmed(confirmed, ids, index) {
  const cleanIds = ids.filter(Boolean);
  if (confirmed.size > 0 && !cleanIds.some((id) => confirmed.has(id))) {
    throw new Error(`operation #${index + 1} 目标不匹配：已确认目标 ${Array.from(confirmed).join(', ')}，本次目标 ${cleanIds.join(', ') || '(empty)'}。`);
  }
}

export function rebuildSearchIndex() {
  db.prepare('DELETE FROM entity_search_fts').run();
  for (const entity of listEntities()) {
    refreshEntitySearch(entity.id);
  }
}

function refreshEntitySearch(entityId) {
  const entity = getEntity(entityId);
  if (!entity) return;
  const aliases = listAliases(entityId);
  const components = listComponents(entityId).map((component) => stringifySearchable(component.data)).join('\n');
  const relationships = listRelationships({ entityId }).map((relationship) => `${relationship.type} ${relationship.data?.summary ?? ''}`).join('\n');
  db.prepare('DELETE FROM entity_search_fts WHERE entity_id = ?').run(entityId);
  db.prepare('INSERT INTO entity_search_fts (entity_id, name, aliases, body) VALUES (?, ?, ?, ?)').run(
    entity.id,
    entity.name,
    aliases.join(' '),
    [entity.kind, components, relationships].join('\n'),
  );
}

function parseRelationshipRow(row) {
  return {
    id: row.id,
    sourceEntityId: row.sourceEntityId,
    targetEntityId: row.targetEntityId,
    type: row.type,
    value: row.value,
    data: JSON.parse(row.dataJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function stringifySearchable(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(stringifySearchable).join(' ');
  if (typeof value === 'object') return Object.values(value).map(stringifySearchable).join(' ');
  return '';
}

function escapeFtsQuery(query) {
  return query.split(/\s+/).filter(Boolean).map((part) => `"${part.replace(/"/g, '""')}"`).join(' OR ');
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function normalizePath(path) {
  if (Array.isArray(path)) return path.map((item) => String(item).trim()).filter(Boolean);
  if (typeof path === 'string' && path.trim()) {
    return path
      .replace(/^\/+/, '')
      .split(/[/.]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function setAtPath(base, path, value) {
  const output = isRecord(base) ? structuredClone(base) : {};
  let cursor = output;
  for (const [index, key] of path.entries()) {
    if (index === path.length - 1) {
      cursor[key] = value;
    } else {
      if (!isRecord(cursor[key])) cursor[key] = {};
      cursor = cursor[key];
    }
  }
  return output;
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
