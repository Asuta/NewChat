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

const SEVEN_DAY_CROWN_SCENE_ASSETS = [
  ['scene_ash_chapel', 'asset_scene_ash_chapel_backdrop', 'scenes/scene-scene_ash_chapel-backdrop.png'],
  ['scene_outer_gate', 'asset_scene_outer_gate_backdrop', 'scenes/scene-scene_outer_gate-backdrop.png'],
  ['scene_registry', 'asset_scene_registry_backdrop', 'scenes/scene-scene_registry-backdrop.png'],
  ['scene_knight_hall', 'asset_scene_knight_hall_backdrop', 'scenes/scene-scene_knight_hall-backdrop.png'],
  ['scene_sanctum', 'asset_scene_sanctum_backdrop', 'scenes/scene-scene_sanctum-backdrop.png'],
  ['scene_people_theater', 'asset_scene_people_theater_backdrop', 'scenes/scene-scene_people_theater-backdrop.png'],
  ['scene_blackstone_tomb', 'asset_scene_blackstone_tomb_backdrop', 'scenes/scene-scene_blackstone_tomb-backdrop.png'],
  ['scene_mirror_archive', 'asset_scene_mirror_archive_backdrop', 'scenes/scene-scene_mirror_archive-backdrop.png'],
  ['scene_crown_hall', 'asset_scene_crown_hall_backdrop', 'scenes/scene-scene_crown_hall-backdrop.png'],
];

const SEVEN_DAY_CROWN_CHARACTER_ASSETS = [
  ['character_elena', 'asset_character_elena_idle', 'characters/npc-character_elena-idle.png'],
  ['character_rowan', 'asset_character_rowan_idle', 'characters/npc-character_rowan-idle.png'],
  ['character_milo', 'asset_character_milo_idle', 'characters/npc-character_milo-idle.png'],
  ['character_aldric', 'asset_character_aldric_idle', 'characters/npc-character_aldric-idle.png'],
  ['character_eve', 'asset_character_eve_idle', 'characters/npc-character_eve-idle.png'],
  ['character_kaen', 'asset_character_kaen_idle', 'characters/npc-character_kaen-idle.png'],
  ['character_hollow_knight', 'asset_character_hollow_knight_idle', 'characters/npc-character_hollow_knight-idle.png'],
  ['character_crown_will', 'asset_character_crown_will_idle', 'characters/npc-character_crown_will-idle.png'],
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
      hiddenCharacterCount: Math.max(0, stageCharacters.length - 3),
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

  upsertEntityBinding(database, 'character_elena', FALLBACK_CHARACTER_ASSET_ID, 'auto', 1);
  seedSevenDayCrownAssets(database);
}

function seedSevenDayCrownAssets(database) {
  for (const [sceneEntityId, assetId, assetPath] of SEVEN_DAY_CROWN_SCENE_ASSETS) {
    if (!existsSync(join(PRESENTATION_ASSETS_DIR, assetPath))) continue;
    upsertAsset(database, {
      id: assetId,
      type: 'background',
      path: assetPath,
      mimeType: 'image/png',
      metadata: {
        generated: true,
        provider: 'ai-pixel-image2',
        model: 'gpt-image-2',
      },
    });
    upsertSceneBinding(database, sceneEntityId, assetId);
  }

  for (const [entityId, assetId, assetPath] of SEVEN_DAY_CROWN_CHARACTER_ASSETS) {
    if (!existsSync(join(PRESENTATION_ASSETS_DIR, assetPath))) continue;
    upsertAsset(database, {
      id: assetId,
      type: 'portrait',
      path: assetPath,
      mimeType: 'image/png',
      metadata: {
        generated: true,
        provider: 'ai-pixel-image2',
        model: 'gpt-image-2',
      },
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
        metadata: {
          discovered: true,
          portraitState: state,
        },
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
