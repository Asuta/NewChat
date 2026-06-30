import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR } from './saveManager.js';

export const PRESENTATION_DIR = join(DATA_DIR, 'presentation');
export const PRESENTATION_ASSETS_DIR = join(PRESENTATION_DIR, 'assets');
export const PRESENTATION_DB_FILE = join(PRESENTATION_DIR, 'presentation.sqlite');

const nowSql = "datetime('now')";
const FALLBACK_CHARACTER_ASSET_ID = 'asset_character_placeholder';

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
      const isFallbackPortrait = !portraitUrl && Boolean(fallbackPortraitUrl);
      return {
        entityId: entity.id,
        name: entity.name,
        kind: entity.kind,
        portraitUrl: portraitUrl || fallbackPortraitUrl,
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
      characters: assignStageSlots(stageCharacters),
      hiddenCharacterCount: Math.max(0, stageCharacters.length - 3),
    };
  } finally {
    database.close();
  }
}

function openPresentationDatabase() {
  mkdirSync(PRESENTATION_DIR, { recursive: true });
  const database = new DatabaseSync(PRESENTATION_DB_FILE);
  database.exec('PRAGMA foreign_keys = ON;');
  return database;
}

function seedDefaults(database) {
  upsertAsset(database, {
    id: 'asset_scene_tavern_background',
    type: 'background',
    path: 'scenes/mist-tavern.png',
    mimeType: 'image/png',
    metadata: { label: '雾港酒馆默认背景' },
  });
  upsertAsset(database, {
    id: 'asset_scene_market_background',
    type: 'background',
    path: 'scenes/mist-market.png',
    mimeType: 'image/png',
    metadata: { label: '旧市集默认背景' },
  });
  upsertAsset(database, {
    id: 'asset_character_lina_portrait',
    type: 'portrait',
    path: 'characters/lina/idle.png',
    mimeType: 'image/png',
    metadata: { label: '莉娜默认立绘' },
  });
  upsertAsset(database, {
    id: FALLBACK_CHARACTER_ASSET_ID,
    type: 'portrait',
    path: 'characters/_fallback/placeholder.png',
    mimeType: 'image/png',
    metadata: { label: '临时 NPC 默认站位图', fallback: true },
  });

  upsertSceneBinding(database, 'scene_tavern', 'asset_scene_tavern_background');
  upsertSceneBinding(database, 'scene_market', 'asset_scene_market_background');
  upsertEntityBinding(database, 'character_lina', 'asset_character_lina_portrait', 'center', 1);
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
     ON CONFLICT(scene_entity_id) DO NOTHING`,
  ).run(sceneEntityId, backgroundAssetId);
}

function upsertEntityBinding(database, entityId, portraitAssetId, position, scale) {
  database.prepare(
    `INSERT INTO presentation_entity_bindings (entity_id, portrait_asset_id, position, scale, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, '{}', ${nowSql}, ${nowSql})
     ON CONFLICT(entity_id) DO NOTHING`,
  ).run(entityId, portraitAssetId, position, scale);
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
