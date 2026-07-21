import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PRESENTATION_ASSETS_DIR, PRESENTATION_DB_FILE, PRESENTATION_DIR } from './saveManager.js';
import {
  mergePortraitAssetIds,
  PORTRAIT_STATES,
  readPortraitAssetIds,
} from './presentationPortraits.js';
import { derivePresentationVitalState } from './presentationState.js';
import { getComponent, getEntity } from './worldDb.js';

export { PRESENTATION_ASSETS_DIR, PRESENTATION_DB_FILE, PRESENTATION_DIR };

const nowSql = "datetime('now')";
const FALLBACK_CHARACTER_ASSET_ID = 'asset_character_placeholder';

const MA_DASHUAI_SCENE_ASSETS = [
  ['scene_bus_station', 'asset_scene_bus_station_backdrop', 'scenes/scene-scene_bus_station-backdrop.png'],
  ['scene_city_street', 'asset_scene_city_street_backdrop', 'scenes/scene-scene_city_street-backdrop.png'],
  ['scene_victoria', 'asset_scene_victoria_backdrop', 'scenes/scene-scene_victoria-backdrop.png'],
  ['scene_guiying_restaurant', 'asset_scene_guiying_restaurant_backdrop', 'scenes/scene-scene_guiying_restaurant-backdrop.png'],
  ['scene_bathhouse', 'asset_scene_bathhouse_backdrop', 'scenes/scene-scene_bathhouse-backdrop.png'],
  ['scene_debiao_home', 'asset_scene_debiao_home_backdrop', 'scenes/scene-scene_yufen_home-backdrop.png'],
  ['scene_majia_village', 'asset_scene_majia_village_backdrop', 'scenes/scene-scene_majia_village-backdrop.png'],
  ['scene_migrant_school', 'asset_scene_migrant_school_backdrop', 'scenes/scene-scene_migrant_school-backdrop.png'],
];

const MA_DASHUAI_CHARACTER_ASSETS = [
  ['character_yufen', 'asset_character_yufen_idle', 'characters/npc-character_yufen-idle.png'],
  ['character_fan_debiao', 'asset_character_fan_debiao_idle', 'characters/npc-character_fan_debiao-idle.png'],
  ['character_ma_xiaocui', 'asset_character_ma_xiaocui_idle', 'characters/npc-character_ma_xiaocui-idle.png'],
  ['character_guiying', 'asset_character_guiying_idle', 'characters/npc-character_guiying-idle.png'],
  ['character_wu', 'asset_character_wu_idle', 'characters/npc-character_wu-idle.png'],
  ['character_awei', 'asset_character_awei_idle', 'characters/npc-character_awei-idle.png'],
  ['character_yu_fugui', 'asset_character_yu_fugui_idle', 'characters/npc-character_yu_fugui-idle.png'],
  ['character_gangzi', 'asset_character_gangzi_idle', 'characters/npc-character_gangzi-idle.png'],
  ['character_yu_decai', 'asset_character_yu_decai_idle', 'characters/npc-character_yu_decai-idle.png'],
  ['character_niu_er', 'asset_character_niu_er_idle', 'characters/npc-character_niu_er-idle.png'],
  ['character_xiaoyun', 'asset_character_xiaoyun_idle', 'characters/npc-character_xiaoyun-idle.png'],
  ['character_erhu_busker', 'asset_character_erhu_busker_idle', 'characters/npc-character_erhu_busker-idle.png'],
  ['character_wandering_child', 'asset_character_wandering_child_idle', 'characters/npc-character_wandering_child-idle.png'],
  ['character_gangzi_brother', 'asset_character_gangzi_brother_idle', 'characters/npc-character_gangzi_brother-idle.png'],
  ['character_lao_ba', 'asset_character_lao_ba_idle', 'characters/npc-character_lao_ba-idle.png'],
  ['character_lao_qian', 'asset_character_lao_qian_idle', 'characters/npc-character_lao_qian-idle.png'],
  ['character_gao_juzhang', 'asset_character_gao_juzhang_idle', 'characters/npc-character_gao_juzhang-idle.png'],
  ['character_wang_boss', 'asset_character_wang_boss_idle', 'characters/npc-character_wang_boss-idle.png'],
  ['character_boxer_son', 'asset_character_boxer_son_idle', 'characters/npc-character_boxer_son-idle.png'],
  ['character_su_old_lady', 'asset_character_su_old_lady_idle', 'characters/npc-character_su_old_lady-idle.png'],
];

export function ensurePresentationDb() {
  mkdirSync(PRESENTATION_ASSETS_DIR, { recursive: true });
  const database = openPresentationDatabase();
  try {
    database.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS presentation_assets (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        path TEXT NOT NULL,
        mime_type TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (${nowSql}),
        updated_at TEXT NOT NULL DEFAULT (${nowSql})
      );

      CREATE TABLE IF NOT EXISTS presentation_scene_bindings (
        scene_entity_id TEXT PRIMARY KEY,
        background_asset_id TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (${nowSql}),
        updated_at TEXT NOT NULL DEFAULT (${nowSql}),
        FOREIGN KEY (background_asset_id) REFERENCES presentation_assets(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS presentation_entity_bindings (
        entity_id TEXT PRIMARY KEY,
        portrait_asset_id TEXT,
        position TEXT NOT NULL DEFAULT 'auto',
        scale REAL NOT NULL DEFAULT 1,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (${nowSql}),
        updated_at TEXT NOT NULL DEFAULT (${nowSql}),
        FOREIGN KEY (portrait_asset_id) REFERENCES presentation_assets(id) ON DELETE SET NULL
      );
    `);
    seedDefaults(database);
  } finally {
    database.close();
  }
}

export function getPresentationCatalog() {
  const database = openPresentationDatabase();
  try {
    return {
      assets: database.prepare(
        `SELECT id, type, path, mime_type as mimeType, metadata FROM presentation_assets ORDER BY type, id`,
      ).all().map(formatAsset),
      scenes: database.prepare(
        `SELECT scene_entity_id as sceneEntityId, background_asset_id as backgroundAssetId, metadata
         FROM presentation_scene_bindings
         ORDER BY scene_entity_id`,
      ).all().map(formatSceneBinding),
      entities: database.prepare(
        `SELECT entity_id as entityId, portrait_asset_id as portraitAssetId, position, scale, metadata
         FROM presentation_entity_bindings
         ORDER BY entity_id`,
      ).all().map(formatEntityBinding),
    };
  } finally {
    database.close();
  }
}

export function getCurrentPresentationStage(sceneState) {
  const scene = sceneState?.scene ?? null;
  const sceneId = scene?.id ?? null;
  const database = openPresentationDatabase();
  try {
    const backgroundAsset = sceneId ? getSceneBackgroundAsset(database, sceneId) : null;
    const fallbackPortraitAsset = getAsset(database, FALLBACK_CHARACTER_ASSET_ID);
    const residents = Array.isArray(sceneState?.residents) ? sceneState.residents : [];
    const stageCharacters = residents.map((entity) => {
      const binding = getEntityBinding(database, entity.id);
      const portraitAsset = binding?.portraitAssetId ? getAsset(database, binding.portraitAssetId) : null;
      const portraitUrl = toAssetUrl(portraitAsset);
      const fallbackPortraitUrl = toAssetUrl(fallbackPortraitAsset);
      const defaultPortraitUrl = portraitUrl || fallbackPortraitUrl;
      const portraitUrls = {
        ...(defaultPortraitUrl ? { neutral: defaultPortraitUrl } : {}),
        ...getPortraitVariantUrls(database, binding?.metadata),
      };
      const isFallbackPortrait = !portraitUrl && Boolean(fallbackPortraitUrl);
      const health = getPresentationHealth(entity.id);
      const status = getComponent(entity.id, 'status');
      return {
        entityId: entity.id,
        name: entity.name,
        kind: entity.kind,
        health,
        vitalState: derivePresentationVitalState(status, health),
        portraitUrl: defaultPortraitUrl,
        portraitUrls,
        position: binding?.position || 'auto',
        scale: typeof binding?.scale === 'number' ? binding.scale : 1,
        hasBinding: Boolean(binding),
        isFallbackPortrait,
      };
    });
    return {
      scene: scene
        ? {
            id: scene.id,
            name: scene.name,
            description: sceneState?.sceneComponent?.description || '',
          }
        : null,
      backgroundUrl: toAssetUrl(backgroundAsset),
      player: getPresentationPlayer(sceneState?.playerId),
      characters: assignStageSlots(stageCharacters),
    };
  } finally {
    database.close();
  }
}

function getPresentationPlayer(playerId) {
  const entityId = typeof playerId === 'string' ? playerId.trim() : '';
  const player = entityId ? getEntity(entityId) : null;
  if (!player) return null;

  const identity = getComponent(entityId, 'identity') || {};
  const stats = getComponent(entityId, 'stats') || {};
  const status = getComponent(entityId, 'status') || {};
  const health = getPresentationHealth(entityId);
  const vitalState = derivePresentationVitalState(status, health);
  const level = toFiniteNumber(stats.level ?? identity.level);
  const armorClass = toFiniteNumber(stats.armorClass ?? stats.ac);

  return {
    entityId,
    name: player.name,
    level: level === null ? null : Math.max(1, Math.floor(level)),
    armorClass: armorClass === null ? null : Math.max(0, Math.floor(armorClass)),
    health,
    vitalState,
    statusLabel: typeof status.label === 'string' ? status.label.trim() : '',
    canAct: vitalState === 'active' && status.canAct !== false,
  };
}

function getPresentationHealth(entityId) {
  const stats = getComponent(entityId, 'stats');
  const currentHitPoints = toFiniteNumber(stats?.currentHitPoints);
  const maxHitPoints = toFiniteNumber(stats?.maxHitPoints);
  if (currentHitPoints === null || maxHitPoints === null || maxHitPoints <= 0) {
    return null;
  }
  return {
    currentHitPoints: Math.min(maxHitPoints, Math.max(0, currentHitPoints)),
    maxHitPoints,
  };
}

function toFiniteNumber(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function openPresentationDatabase() {
  mkdirSync(PRESENTATION_DIR, { recursive: true });
  const database = new DatabaseSync(PRESENTATION_DB_FILE);
  database.exec('PRAGMA foreign_keys = ON;');
  return database;
}

function seedDefaults(database) {
  upsertAsset(database, {
    id: FALLBACK_CHARACTER_ASSET_ID,
    type: 'portrait',
    path: 'characters/_fallback/placeholder.png',
    mimeType: 'image/png',
    metadata: { label: '临时 NPC 默认站位图', fallback: true },
  });

  upsertEntityBinding(database, 'character_yufen', FALLBACK_CHARACTER_ASSET_ID, 'auto', 1);
  seedMaDashuaiAssets(database);
}

function seedMaDashuaiAssets(database) {
  for (const [sceneEntityId, assetId, assetPath] of MA_DASHUAI_SCENE_ASSETS) {
    if (!existsSync(join(PRESENTATION_ASSETS_DIR, assetPath))) continue;
    upsertAsset(database, {
      id: assetId,
      type: 'background',
      path: assetPath,
      mimeType: 'image/png',
      metadata: { generated: true, campaignId: 'ma-dashuai-city-life' },
    });
    upsertSceneBinding(database, sceneEntityId, assetId);
  }

  for (const [entityId, assetId, assetPath] of MA_DASHUAI_CHARACTER_ASSETS) {
    if (!existsSync(join(PRESENTATION_ASSETS_DIR, assetPath))) continue;
    upsertAsset(database, {
      id: assetId,
      type: 'portrait',
      path: assetPath,
      mimeType: 'image/png',
      metadata: { generated: true, campaignId: 'ma-dashuai-city-life' },
    });
    const portraitAssetIds = {};
    for (const state of PORTRAIT_STATES) {
      if (state === 'neutral') continue;
      const variantPath = assetPath.replace(/-idle\.png$/i, `-${state}.png`);
      if (variantPath === assetPath || !existsSync(join(PRESENTATION_ASSETS_DIR, variantPath))) continue;
      const variantAssetId = `${assetId.replace(/_idle$/i, '')}_${state}`;
      upsertAsset(database, {
        id: variantAssetId,
        type: 'portrait',
        path: variantPath,
        mimeType: 'image/png',
        metadata: { discovered: true, portraitState: state, campaignId: 'ma-dashuai-city-life' },
      });
      portraitAssetIds[state] = variantAssetId;
    }
    upsertEntityBinding(database, entityId, assetId, 'auto', 1, { portraits: portraitAssetIds });
  }
}

function upsertAsset(database, asset) {
  database.prepare(
    `INSERT INTO presentation_assets (id, type, path, mime_type, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ${nowSql}, ${nowSql})
     ON CONFLICT(id) DO UPDATE SET
       type = excluded.type,
       path = excluded.path,
       mime_type = excluded.mime_type,
       metadata = excluded.metadata,
       updated_at = ${nowSql}`,
  ).run(asset.id, asset.type, asset.path, asset.mimeType, JSON.stringify(asset.metadata || {}));
}

function upsertSceneBinding(database, sceneEntityId, backgroundAssetId) {
  database.prepare(
    `INSERT INTO presentation_scene_bindings (scene_entity_id, background_asset_id, metadata, created_at, updated_at)
     VALUES (?, ?, '{}', ${nowSql}, ${nowSql})
     ON CONFLICT(scene_entity_id) DO UPDATE SET
       background_asset_id = excluded.background_asset_id,
       updated_at = ${nowSql}`,
  ).run(sceneEntityId, backgroundAssetId);
}

function upsertEntityBinding(database, entityId, portraitAssetId, position, scale, metadata = null) {
  const currentMetadata = getEntityBinding(database, entityId)?.metadata || {};
  const nextMetadata = metadata
    ? mergePortraitAssetIds({ ...metadata, ...currentMetadata }, metadata.portraits)
    : currentMetadata;
  database.prepare(
    `INSERT INTO presentation_entity_bindings (entity_id, portrait_asset_id, position, scale, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ${nowSql}, ${nowSql})
     ON CONFLICT(entity_id) DO UPDATE SET
       portrait_asset_id = excluded.portrait_asset_id,
       position = excluded.position,
       scale = excluded.scale,
       metadata = excluded.metadata,
       updated_at = ${nowSql}`,
  ).run(entityId, portraitAssetId, position, scale, JSON.stringify(nextMetadata));
}

function getSceneBackgroundAsset(database, sceneEntityId) {
  const row = database.prepare(
    `SELECT asset.id, asset.type, asset.path, asset.mime_type as mimeType, asset.metadata
     FROM presentation_scene_bindings binding
     LEFT JOIN presentation_assets asset ON asset.id = binding.background_asset_id
     WHERE binding.scene_entity_id = ?`,
  ).get(sceneEntityId);
  return row?.id ? formatAsset(row) : null;
}

function getEntityBinding(database, entityId) {
  const row = database.prepare(
    `SELECT entity_id as entityId, portrait_asset_id as portraitAssetId, position, scale, metadata
     FROM presentation_entity_bindings
     WHERE entity_id = ?`,
  ).get(entityId);
  return row ? formatEntityBinding(row) : null;
}

function getAsset(database, assetId) {
  const row = database.prepare(
    `SELECT id, type, path, mime_type as mimeType, metadata FROM presentation_assets WHERE id = ?`,
  ).get(assetId);
  return row ? formatAsset(row) : null;
}

function getPortraitVariantUrls(database, metadata) {
  const result = {};
  for (const [state, assetId] of Object.entries(readPortraitAssetIds(metadata))) {
    const url = toAssetUrl(getAsset(database, assetId));
    if (url) result[state] = url;
  }
  return result;
}

function assignStageSlots(characters) {
  const slotsByCount = {
    1: ['center'],
    2: ['left', 'right'],
    3: ['left', 'center', 'right'],
  };
  const slots = slotsByCount[Math.min(characters.length, 3)] || [];
  return characters.map((character, index) => ({
    ...character,
    slot: character.position && character.position !== 'auto' ? character.position : slots[index] || 'center',
  }));
}

function toAssetUrl(asset) {
  if (!asset?.path || !isSafeRelativePath(asset.path)) return null;
  const normalized = asset.path.replace(/\\/g, '/');
  const exists = existsSync(join(PRESENTATION_ASSETS_DIR, normalized));
  if (!exists) return null;
  return `/api/presentation/assets/${normalized.split('/').map(encodeURIComponent).join('/')}`;
}

function isSafeRelativePath(value) {
  const normalized = String(value || '').replace(/\\/g, '/');
  return Boolean(normalized) && !normalized.startsWith('/') && !normalized.includes('../') && normalized !== '..';
}

function formatAsset(row) {
  return {
    id: row.id,
    type: row.type,
    path: row.path,
    url: toAssetUrl(row),
    mimeType: row.mimeType || null,
    metadata: parseMetadata(row.metadata),
  };
}

function formatSceneBinding(row) {
  return {
    sceneEntityId: row.sceneEntityId,
    backgroundAssetId: row.backgroundAssetId || null,
    metadata: parseMetadata(row.metadata),
  };
}

function formatEntityBinding(row) {
  return {
    entityId: row.entityId,
    portraitAssetId: row.portraitAssetId || null,
    position: row.position || 'auto',
    scale: typeof row.scale === 'number' ? row.scale : 1,
    metadata: parseMetadata(row.metadata),
  };
}

function parseMetadata(value) {
  if (!value || typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
