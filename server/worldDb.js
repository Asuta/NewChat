import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SAVE_DB_FILE } from './saveManager.js';
import {
  ensureMaDashuaiPlayableState,
  getMaDashuaiPlayerStats,
  seedMaDashuaiWorld,
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
    seedMaDashuaiWorld({
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
    ensureMaDashuaiPlayableState({
      getEntity,
      upsertEntity,
      setAliases,
      mergeComponentDefaults,
      applyStatsProfile,
      mergeInventoryDefaults,
      listRelationships,
      upsertRelationship,
      getMeta,
      setMeta,
    });
  });
}

function getDefaultPlayerStats() {
  return getMaDashuaiPlayerStats();
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

const WORLD_CLOCK_META_KEY = 'worldClock.absoluteMinutes';
const CURRENT_SCENE_VISIT_META_KEY = 'worldClock.currentSceneVisit';
const WORLD_TIME_CHECKPOINT_META_KEY = 'worldClock.checkpoint';
const DEFAULT_WORLD_START_MINUTES = 12 * 60;
const MAX_SCENE_TRANSITION_MINUTES = 8 * 60;
const MAX_TIME_UPDATE_MINUTES = 7 * 24 * 60;
const MAX_PENDING_TIME_EVENTS = 40;

export function getWorldTimeState() {
  const clock = getWorldClock();
  const currentScene = getCurrentScene();
  const visit = getCurrentSceneVisit(currentScene.scene);
  const checkpoint = getWorldTimeCheckpoint(currentScene.scene);
  const pendingEventCount = countPendingTimeEvents(checkpoint.conversationCursor);
  return {
    clock,
    checkpoint,
    pendingEventCount,
    currentSceneVisit: visit,
  };
}

export function getWorldTimeContext() {
  const currentScene = getCurrentScene();
  const checkpoint = getWorldTimeCheckpoint(currentScene.scene);
  const pendingEventCount = countPendingTimeEvents(checkpoint.conversationCursor);
  const pendingEvents = listPendingTimeEvents(checkpoint.conversationCursor, MAX_PENDING_TIME_EVENTS);
  const latestConversationId = pendingEvents.at(-1)?.id ?? checkpoint.conversationCursor;
  return {
    clock: getWorldClock(),
    checkpoint,
    currentSceneVisit: getCurrentSceneVisit(currentScene.scene),
    pendingEvents,
    pendingEventCount,
    latestConversationId,
    hasMorePendingEvents: pendingEventCount > pendingEvents.length,
  };
}

export function updateWorldTime(options = {}) {
  return withTransaction(() => {
    const currentScene = getCurrentScene();
    const context = getWorldTimeContext();
    const clockBefore = getWorldClock();
    const timeSegments = normalizeTimeSegments(
      options.timeSegments,
      'timeSegments',
      clockBefore.absoluteMinutes,
    );
    const elapsedMinutes = sumTimeSegments(timeSegments);
    const throughConversationId = requireConversationCursor(
      options.throughConversationId,
      context.checkpoint.conversationCursor,
      context.latestConversationId,
    );
    const reason = requireTransitionText(options.reason, 'reason');
    const summary = requireTransitionText(options.summary, 'summary');
    assertPendingAbsoluteTimeSatisfied({
      fromConversationId: context.checkpoint.conversationCursor,
      throughConversationId,
      startingAbsoluteMinutes: clockBefore.absoluteMinutes,
      elapsedMinutes,
      fieldName: 'timeSegments',
    });
    if (throughConversationId === context.checkpoint.conversationCursor && elapsedMinutes > 0) {
      throw new Error('This conversation cursor is already settled; nonzero time cannot be applied twice.');
    }
    const clockAfter = createClockState(clockBefore.absoluteMinutes + elapsedMinutes);
    const checkpoint = createWorldTimeCheckpoint({
      absoluteMinutes: clockAfter.absoluteMinutes,
      conversationCursor: throughConversationId,
      scene: currentScene.scene,
      reason,
      summary,
    });

    setWorldClock(clockAfter.absoluteMinutes);
    setWorldTimeCheckpoint(checkpoint);
    addEvent('world.time.updated', currentScene.playerId, currentScene.scene?.id ?? null, {
      summary: `世界时间推进 ${elapsedMinutes} 分钟至 ${clockAfter.fullLabel}。`,
      elapsedMinutes,
      timeSegments,
      reason,
      eventSummary: summary,
      throughConversationId,
      clockBefore,
      clockAfter,
      checkpoint,
    });

    return {
      elapsedMinutes,
      timeSegments,
      reason,
      summary,
      throughConversationId,
      clockBefore,
      clockAfter,
      checkpoint: decorateWorldTimeCheckpoint(checkpoint),
    };
  });
}

function getWorldClock() {
  const absoluteMinutes = parseStoredInteger(getMeta(WORLD_CLOCK_META_KEY, ''), DEFAULT_WORLD_START_MINUTES);
  return createClockState(absoluteMinutes);
}

function setWorldClock(absoluteMinutes) {
  setMeta(WORLD_CLOCK_META_KEY, String(Math.max(0, Math.round(Number(absoluteMinutes) || 0))));
}

function getWorldTimeCheckpoint(scene = null) {
  const stored = parseJsonMeta(WORLD_TIME_CHECKPOINT_META_KEY);
  if (
    stored
    && Number.isInteger(stored.absoluteMinutes)
    && stored.absoluteMinutes >= 0
    && Number.isInteger(stored.conversationCursor)
    && stored.conversationCursor >= 0
  ) {
    return decorateWorldTimeCheckpoint(stored);
  }

  const checkpoint = createWorldTimeCheckpoint({
    absoluteMinutes: getWorldClock().absoluteMinutes,
    conversationCursor: getLatestConversationId(),
    scene,
    reason: '初始化世界时间检查点。',
    summary: '从当前存档状态开始记录尚未结算的剧情时间。',
  });
  setWorldTimeCheckpoint(checkpoint);
  return decorateWorldTimeCheckpoint(checkpoint);
}

function createWorldTimeCheckpoint({ absoluteMinutes, conversationCursor, scene, reason, summary }) {
  return {
    absoluteMinutes: Math.max(0, Math.round(Number(absoluteMinutes) || 0)),
    conversationCursor: Math.max(0, Math.round(Number(conversationCursor) || 0)),
    sceneId: scene?.id || '',
    sceneName: scene?.name || scene?.id || '未知场景',
    reason: String(reason || '').trim(),
    summary: String(summary || '').trim(),
    updatedAt: nowIso(),
  };
}

function decorateWorldTimeCheckpoint(checkpoint) {
  return {
    ...checkpoint,
    clock: createClockState(checkpoint.absoluteMinutes),
  };
}

function setWorldTimeCheckpoint(checkpoint) {
  const { clock: _clock, ...stored } = checkpoint;
  setMeta(WORLD_TIME_CHECKPOINT_META_KEY, JSON.stringify(stored));
}

function getLatestConversationId() {
  const row = db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM conversations').get();
  return Number(row?.id || 0);
}

function countPendingTimeEvents(conversationCursor) {
  const row = db.prepare('SELECT COUNT(*) AS count FROM conversations WHERE id > ?').get(conversationCursor);
  return Number(row?.count || 0);
}

function listPendingTimeEvents(conversationCursor, limit) {
  return db.prepare(`
    SELECT id, speaker_id as speakerId, speaker_name as speakerName, role, content, created_at as createdAt
    FROM conversations
    WHERE id > ?
    ORDER BY id ASC
    LIMIT ?
  `).all(conversationCursor, limit).map((row) => {
    const content = String(row.content || '').replace(/\s+/g, ' ').trim();
    const timeEvidence = extractTimeEvidence(content);
    return {
      ...row,
      content: compactPendingEventContent(content),
      ...(content.length > 2400 ? { contentTruncated: true } : {}),
      ...(timeEvidence.length ? { timeEvidence } : {}),
    };
  });
}

function compactPendingEventContent(content) {
  if (content.length <= 2400) return content;
  return `${content.slice(0, 1200)} ...[middle omitted]... ${content.slice(-1200)}`;
}

function extractTimeEvidence(content) {
  const evidence = [];
  const patterns = [
    /(?:[01]?\d|2[0-3])[:：][0-5]\d/g,
    /(?:凌晨|早上|上午|中午|下午|傍晚|晚上|夜里)?\s*(?:\d{1,2}|[一二三四五六七八九十两]+)\s*点(?:半|钟|\d{1,2}\s*分)?/g,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const start = Math.max(0, Number(match.index || 0) - 80);
      const end = Math.min(content.length, Number(match.index || 0) + match[0].length + 80);
      const snippet = content.slice(start, end).trim();
      if (snippet && !evidence.includes(snippet)) evidence.push(snippet);
      if (evidence.length >= 32) return evidence;
    }
  }
  return evidence;
}

function createClockState(absoluteMinutes) {
  const normalized = Math.max(0, Math.round(Number(absoluteMinutes) || 0));
  const day = Math.floor(normalized / 1440) + 1;
  const minuteOfDay = normalized % 1440;
  return {
    absoluteMinutes: normalized,
    day,
    minuteOfDay,
    label: formatMinuteOfDay(minuteOfDay),
    dayLabel: `第 ${day} 日`,
    fullLabel: `第 ${day} 日 ${formatMinuteOfDay(minuteOfDay)}`,
  };
}

function formatMinuteOfDay(minuteOfDay) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseStoredInteger(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function getCurrentSceneVisit(scene = null) {
  const stored = parseJsonMeta(CURRENT_SCENE_VISIT_META_KEY);
  const clock = getWorldClock();
  const sceneMatches = !scene?.id || stored?.sceneId === scene.id;
  if (stored && typeof stored.sceneId === 'string' && stored.sceneId && sceneMatches) {
    return {
      ...stored,
      elapsedMinutes: Math.max(0, clock.absoluteMinutes - Number(stored.enteredAt || clock.absoluteMinutes)),
    };
  }

  const visit = createSceneVisit({
    scene,
    enteredAt: clock.absoluteMinutes,
    previousVisitId: stored?.id || null,
  });
  setCurrentSceneVisit(visit);
  return visit;
}

function setCurrentSceneVisit(visit) {
  setMeta(CURRENT_SCENE_VISIT_META_KEY, JSON.stringify(visit));
}

function parseJsonMeta(key) {
  const raw = getMeta(key, '');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function createSceneVisit({ scene, enteredAt, previousVisitId = null }) {
  const clock = createClockState(enteredAt);
  return {
    id: `visit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    sceneId: scene?.id || '',
    sceneName: scene?.name || scene?.id || '未知场景',
    enteredAt: clock.absoluteMinutes,
    enteredAtLabel: clock.fullLabel,
    elapsedMinutes: 0,
    previousVisitId,
  };
}

function completeSceneVisit(visit, { leftAt, elapsedMinutes, summary, reason }) {
  const leftClock = createClockState(leftAt);
  return {
    ...visit,
    leftAt: leftClock.absoluteMinutes,
    leftAtLabel: leftClock.fullLabel,
    elapsedMinutes,
    summary,
    reason,
  };
}

function requireElapsedMinutes(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_SCENE_TRANSITION_MINUTES) {
    throw new Error(`elapsedMinutes 必须是 1-${MAX_SCENE_TRANSITION_MINUTES} 之间的整数。`);
  }
  return parsed;
}

function normalizeTimeSegments(value, fieldName, startingAbsoluteMinutes) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} 必须是数组。`);
  }
  let runningAbsoluteMinutes = startingAbsoluteMinutes;
  const segments = value.map((segment, index) => {
    if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
      throw new Error(`${fieldName}[${index}] 必须是对象。`);
    }
    const label = requireTransitionText(segment.label, `${fieldName}[${index}].label`);
    const evidence = requireTransitionText(segment.evidence, `${fieldName}[${index}].evidence`);
    const minutes = Number(segment.minutes);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_TIME_UPDATE_MINUTES) {
      throw new Error(`${fieldName}[${index}].minutes 必须是 0-${MAX_TIME_UPDATE_MINUTES} 之间的整数。`);
    }
    const segmentEvidence = `${label} ${evidence}`;
    const explicitClockTarget = findLastExplicitClockTarget(segmentEvidence, runningAbsoluteMinutes);
    if (!explicitClockTarget && hasUnnormalizedClockTarget(segmentEvidence)) {
      throw new Error(`${fieldName}[${index}] contains an explicit clock target; evidence must include it as HH:MM.`);
    }
    if (explicitClockTarget && minutes !== explicitClockTarget.elapsedMinutes) {
      throw new Error(
        `${fieldName}[${index}] declares explicit clock target ${explicitClockTarget.label}; `
        + `minutes must be ${explicitClockTarget.elapsedMinutes}, not ${minutes}.`,
      );
    }
    runningAbsoluteMinutes += minutes;
    return {
      label,
      minutes,
      evidence,
    };
  });
  if (sumTimeSegments(segments) > MAX_TIME_UPDATE_MINUTES) {
    throw new Error(`单次时间结算不能超过 ${MAX_TIME_UPDATE_MINUTES} 分钟。`);
  }
  return segments;
}

function findLastExplicitClockTarget(text, currentAbsoluteMinutes) {
  const source = String(text || '');
  const clockMatches = [...source.matchAll(/(?:^|\D)([01]?\d|2[0-3])[:：]([0-5]\d)(?!\d)/g)].map((match) => ({
    index: Number(match.index || 0),
    hour: Number(match[1]),
    minute: Number(match[2]),
  }));
  const pointMatches = [...source.matchAll(/(?:凌晨|早上|上午|中午|下午|傍晚|晚上|夜里)?\s*(?:\d{1,2}|[一二三四五六七八九十两]+)\s*点(?:半|\d{1,2}\s*分)?/g)]
    .map((match) => parsePointClockMatch(match))
    .filter(Boolean);
  const matches = [...clockMatches, ...pointMatches].sort((left, right) => left.index - right.index);
  const match = matches.length >= 2
    ? matches.at(-1)
    : matches.find((candidate) => hasClockTargetCue(
        source.slice(Math.max(0, candidate.index - 40), candidate.index),
      ));
  if (!match) return null;
  const { hour, minute } = match;
  const minuteOfDay = hour * 60 + minute;
  const currentDayStart = Math.floor(currentAbsoluteMinutes / 1440) * 1440;
  const prefix = source.slice(Math.max(0, match.index - 40), match.index);
  const dayOffset = getExplicitDayOffset(prefix);
  let targetAbsoluteMinutes = currentDayStart + minuteOfDay + (dayOffset ?? 0) * 1440;
  if (dayOffset === null && targetAbsoluteMinutes < currentAbsoluteMinutes) targetAbsoluteMinutes += 1440;
  return {
    label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    targetAbsoluteMinutes,
    elapsedMinutes: targetAbsoluteMinutes - currentAbsoluteMinutes,
  };
}

function parsePointClockMatch(match) {
  const raw = String(match[0] || '').replace(/\s+/g, '');
  const hourToken = raw.match(/(\d{1,2}|[一二三四五六七八九十两]+)点/)?.[1];
  if (!hourToken) return null;
  let hour = parseChineseClockNumber(hourToken);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  const minute = raw.includes('点半') ? 30 : Number(raw.match(/点(\d{1,2})分/)?.[1] || 0);
  if (minute < 0 || minute > 59) return null;
  if (/(下午|傍晚|晚上|夜里)/.test(raw) && hour < 12) hour += 12;
  if (/中午/.test(raw) && hour < 11) hour += 12;
  if (/凌晨/.test(raw) && hour === 12) hour = 0;
  return { index: Number(match.index || 0), hour, minute };
}

function parseChineseClockNumber(token) {
  if (/^\d+$/.test(token)) return Number(token);
  const digits = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 两: 2 };
  if (token === '十') return 10;
  if (token.startsWith('十')) return 10 + Number(digits[token.slice(1)] || 0);
  if (token.includes('十')) {
    const [tens, ones] = token.split('十');
    return Number(digits[tens] || 0) * 10 + Number(digits[ones] || 0);
  }
  return Number(digits[token] || NaN);
}

function hasClockTargetCue(prefix) {
  return /(?:到|至|直到|睡到|等到|醒于|叫醒|目标|当前时间|现在|时间为|until|wake\s+at|target)/i.test(prefix);
}

function getExplicitDayOffset(prefix) {
  if (/(?:后天|day\s+after\s+tomorrow)/i.test(prefix)) return 2;
  if (/(?:明天|次日|翌日|tomorrow|next\s+day)/i.test(prefix)) return 1;
  if (/(?:今天|今晚|today|tonight)/i.test(prefix)) return 0;
  return null;
}

function hasUnnormalizedClockTarget(text) {
  return /(?:到|至|直到|睡到|等到|醒于|叫醒|until|wake\s+at)[^。！？.!?\n]{0,24}(?:凌晨|早上|上午|中午|下午|傍晚|晚上|夜里)?\s*(?:\d{1,2}|[一二三四五六七八九十两]+)\s*点/i.test(String(text || ''));
}

function assertPendingAbsoluteTimeSatisfied({
  fromConversationId,
  throughConversationId,
  startingAbsoluteMinutes,
  elapsedMinutes,
  fieldName,
}) {
  if (throughConversationId <= fromConversationId) return;
  const events = db.prepare(`
    SELECT id, role, content
    FROM conversations
    WHERE id > ? AND id <= ?
    ORDER BY id ASC
  `).all(fromConversationId, throughConversationId);
  const requiredTargets = extractRequiredAbsoluteTimeTargets(events, startingAbsoluteMinutes);
  const requiredTarget = requiredTargets.reduce((latest, target) => (
    !latest || target.targetAbsoluteMinutes > latest.targetAbsoluteMinutes ? target : latest
  ), null);
  if (!requiredTarget) return;
  const requiredElapsedMinutes = requiredTarget.targetAbsoluteMinutes - startingAbsoluteMinutes;
  if (elapsedMinutes < requiredElapsedMinutes) {
    throw new Error(
      `${fieldName} does not cover pending absolute-time action ${requiredTarget.label}; `
      + `at least ${requiredElapsedMinutes} minutes are required, received ${elapsedMinutes}.`,
    );
  }
}

function extractRequiredAbsoluteTimeTargets(events, startingAbsoluteMinutes) {
  let targets = [];
  for (const event of events) {
    if (event.role !== 'user') continue;
    let content = String(event.content || '');
    const cancellations = [...content.matchAll(/(?:算了|取消|不睡了|不等了|现在(?:就|立刻)?(?:走|出发)|never\s+mind|cancel|leave\s+now|go\s+now)/gi)];
    const cancellation = cancellations.at(-1);
    if (cancellation) {
      targets = [];
      content = content.slice(Number(cancellation.index || 0) + cancellation[0].length);
    }
    if (!/(?:睡|等|休息|治疗|昏迷|叫醒|sleep|wait|rest|nap|wake)/i.test(content)) continue;
    const target = findLastExplicitClockTarget(content, startingAbsoluteMinutes);
    if (target) targets.push({ ...target, conversationId: event.id });
  }
  return targets;
}

function sumTimeSegments(segments) {
  return segments.reduce((total, segment) => total + segment.minutes, 0);
}

function requireConversationCursor(value, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`throughConversationId 必须位于 ${minimum}-${maximum} 之间。`);
  }
  return parsed;
}

function requireTransitionText(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} 不能为空。`);
  }
  return value.trim();
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
  const sceneId = getCurrentLocationId(playerId) || getMeta('currentSceneId', 'scene_bus_station');
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

export function transitionScene(sceneId, options = {}) {
  return withTransaction(() => {
    const playerId = getMeta('playerId', 'player');
    const previousSceneState = getCurrentScene();
    const previousScene = previousSceneState.scene;
    const target = validateSceneEntry(sceneId);
    if (previousScene?.id === target.id) {
      throw new Error(`玩家已经位于 ${target.name}。`);
    }
    if (!Array.isArray(options.sceneTimeSegments)) {
      throw new Error('sceneTimeSegments 必须是数组；旧版 elapsedMinutes 场景切换协议已停用。');
    }
    const clockBefore = getWorldClock();
    const sceneTimeSegments = normalizeTimeSegments(
      options.sceneTimeSegments,
      'sceneTimeSegments',
      clockBefore.absoluteMinutes,
    );
    const sceneElapsedMinutes = sumTimeSegments(sceneTimeSegments);
    const travelMinutes = requireElapsedMinutes(options.travelMinutes);
    const elapsedMinutes = sceneElapsedMinutes + travelMinutes;
    const reason = requireTransitionText(
      options.travelReason,
      'travelReason',
    );
    const summary = requireTransitionText(options.previousSceneSummary ?? options.summary, 'previousSceneSummary');
    const timeContext = getWorldTimeContext();
    const throughConversationId = options.throughConversationId === undefined
      ? timeContext.latestConversationId
      : requireConversationCursor(
          options.throughConversationId,
          timeContext.checkpoint.conversationCursor,
          timeContext.latestConversationId,
        );
    if (timeContext.hasMorePendingEvents || throughConversationId !== timeContext.latestConversationId) {
      throw new Error('切换场景前必须先结算当前批次的全部未结算剧情。');
    }
    assertPendingAbsoluteTimeSatisfied({
      fromConversationId: timeContext.checkpoint.conversationCursor,
      throughConversationId,
      startingAbsoluteMinutes: clockBefore.absoluteMinutes,
      elapsedMinutes: sceneElapsedMinutes,
      fieldName: 'sceneTimeSegments',
    });
    if (timeContext.pendingEventCount === 0 && sceneElapsedMinutes > 0) {
      throw new Error('There are no pending story events; nonzero scene time would double count settled events.');
    }
    const clockAfter = createClockState(clockBefore.absoluteMinutes + elapsedMinutes);
    const currentVisit = getCurrentSceneVisit(previousScene);
    const completedVisit = completeSceneVisit(currentVisit, {
      leftAt: clockAfter.absoluteMinutes,
      elapsedMinutes: Math.max(0, clockAfter.absoluteMinutes - currentVisit.enteredAt),
      summary,
      reason,
    });
    const nextVisit = createSceneVisit({
      scene: target,
      enteredAt: clockAfter.absoluteMinutes,
      previousVisitId: completedVisit.id,
    });

    setWorldClock(clockAfter.absoluteMinutes);
    movePlayerToScene(playerId, target.id, 'transition_scene');
    setCurrentSceneVisit(nextVisit);
    const checkpoint = createWorldTimeCheckpoint({
      absoluteMinutes: clockAfter.absoluteMinutes,
      conversationCursor: throughConversationId,
      scene: target,
      reason,
      summary,
    });
    setWorldTimeCheckpoint(checkpoint);
    addEvent('scene.transition', playerId, target.id, {
      summary: `${previousScene?.name ?? '未知场景'} -> ${target.name}，耗时 ${elapsedMinutes} 分钟，当前时间 ${clockAfter.fullLabel}。`,
      fromSceneId: previousScene?.id ?? null,
      fromSceneName: previousScene?.name ?? '未知场景',
      toSceneId: target.id,
      toSceneName: target.name,
      elapsedMinutes,
      sceneElapsedMinutes,
      sceneTimeSegments,
      travelMinutes,
      travelReason: reason,
      throughConversationId,
      elapsedReason: reason,
      previousSceneSummary: summary,
      clockBefore,
      clockAfter,
      completedVisit,
      currentSceneVisit: nextVisit,
    });
    addEvent('scene.entered', playerId, target.id, { summary: `玩家进入 ${target.name}。`, clock: clockAfter });

    return {
      scene: getCurrentScene(),
      fromScene: previousScene,
      toScene: target,
      elapsedMinutes,
      sceneElapsedMinutes,
      sceneTimeSegments,
      travelMinutes,
      travelReason: reason,
      throughConversationId,
      elapsedReason: reason,
      previousSceneSummary: summary,
      clockBefore,
      clockAfter,
      completedVisit,
      currentSceneVisit: nextVisit,
      checkpoint: decorateWorldTimeCheckpoint(checkpoint),
    };
  });
}

export function enterScene(sceneId) {
  return withTransaction(() => {
    const playerId = getMeta('playerId', 'player');
    const target = validateSceneEntry(sceneId);
    movePlayerToScene(playerId, target.id, 'enter_scene');
    const clock = getWorldClock();
    const nextVisit = createSceneVisit({
      scene: target,
      enteredAt: clock.absoluteMinutes,
      previousVisitId: getCurrentSceneVisit().id,
    });
    setCurrentSceneVisit(nextVisit);
    addEvent('scene.entered', playerId, target.id, { summary: `玩家进入 ${target.name}。`, clock });
    return getCurrentScene();
  });
}

function validateSceneEntry(sceneId) {
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
  return target;
}

function movePlayerToScene(playerId, sceneId, source) {
  setCurrentLocation(playerId, sceneId, source || 'enter_scene');
  setMeta('currentSceneId', sceneId);
}

export function getWorldOverview() {
  const entities = listEntities();
  return {
    currentScene: getCurrentScene(),
    time: getWorldTimeState(),
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
    if (relationshipType === 'ownership') {
      throw new Error('道具所有权只能通过背包动作修改。');
    }
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
    if (relationshipType === 'ownership') {
      throw new Error('道具所有权只能通过背包动作修改。');
    }
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
