export const PORTRAIT_STATES = [
  'neutral',
  'happy',
  'angry',
  'disappointed',
  'hurt',
  'wounded',
];

export const NPC_SPEECH_PORTRAIT_STATES = [
  'neutral',
  'happy',
  'angry',
  'disappointed',
];

const PORTRAIT_STATE_SET = new Set(PORTRAIT_STATES);

export function normalizePortraitState(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return PORTRAIT_STATE_SET.has(normalized) ? normalized : 'neutral';
}

export function readPortraitAssetIds(metadata) {
  if (!isRecord(metadata) || !isRecord(metadata.portraits)) return {};
  const result = {};
  for (const state of PORTRAIT_STATES) {
    if (state === 'neutral') continue;
    const assetId = metadata.portraits[state];
    if (typeof assetId === 'string' && assetId.trim()) result[state] = assetId.trim();
  }
  return result;
}

export function mergePortraitAssetIds(metadata, portraitAssetIds) {
  const current = isRecord(metadata) ? metadata : {};
  const incoming = isRecord(portraitAssetIds) ? portraitAssetIds : {};
  const currentPortraits = readPortraitAssetIds(current);
  const nextPortraits = {};
  for (const state of PORTRAIT_STATES) {
    if (state === 'neutral') continue;
    const incomingAssetId = incoming[state];
    if (typeof incomingAssetId === 'string' && incomingAssetId.trim()) {
      nextPortraits[state] = incomingAssetId.trim();
    }
  }
  return {
    ...current,
    portraits: {
      ...nextPortraits,
      ...currentPortraits,
    },
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
