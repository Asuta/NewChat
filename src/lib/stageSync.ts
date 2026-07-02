import type { PresentationStage, StageNarration, StageSpeech, WorldMapState } from '../types';

export const STAGE_CHANNEL_NAME = 'newchat.stage.v1';
export const STAGE_SNAPSHOT_STORAGE_KEY = 'newchat.stage.snapshot.v1';
const STAGE_SOURCE_HEARTBEAT_STORAGE_KEY = 'newchat.stage.sourceHeartbeat.v1';
const STAGE_SOURCE_HEARTBEAT_MAX_AGE_MS = 5_000;

let publisherChannel: BroadcastChannel | null | undefined;

export interface StageSnapshot {
  stage: PresentationStage | null;
  worldMap: WorldMapState | null;
  activeStageSpeech: StageSpeech | null;
  activeStageNarration: StageNarration | null;
  isLoading: boolean;
  isWorldMapLoading: boolean;
  updatedAt: number;
}

export function publishStageSnapshot(snapshot: StageSnapshot) {
  const serialized = JSON.stringify(snapshot);
  try {
    window.localStorage.setItem(STAGE_SNAPSHOT_STORAGE_KEY, serialized);
  } catch {
    // Keep realtime mirroring alive even if storage is unavailable.
  }
  getPublisherChannel()?.postMessage(snapshot);
}

export function readStageSnapshot(): StageSnapshot | null {
  try {
    const stored = window.localStorage.getItem(STAGE_SNAPSHOT_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as StageSnapshot;
  } catch {
    try {
      window.localStorage.removeItem(STAGE_SNAPSHOT_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
    return null;
  }
}

export function subscribeStageSnapshot(callback: (snapshot: StageSnapshot) => void) {
  const channel = createStageChannel();
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STAGE_SNAPSHOT_STORAGE_KEY || !event.newValue) return;
    try {
      callback(JSON.parse(event.newValue) as StageSnapshot);
    } catch {
      // Ignore malformed snapshots from older tabs.
    }
  };

  channel?.addEventListener('message', (event) => callback(event.data as StageSnapshot));
  window.addEventListener('storage', handleStorage);

  return () => {
    channel?.close();
    window.removeEventListener('storage', handleStorage);
  };
}

export function writeStageSourceHeartbeat() {
  try {
    window.localStorage.setItem(STAGE_SOURCE_HEARTBEAT_STORAGE_KEY, String(Date.now()));
  } catch {
    // The stage page can still use backend fallback without a heartbeat.
  }
}

export function isStageSourceHeartbeatFresh() {
  try {
    const timestamp = Number(window.localStorage.getItem(STAGE_SOURCE_HEARTBEAT_STORAGE_KEY));
    return Number.isFinite(timestamp) && Date.now() - timestamp < STAGE_SOURCE_HEARTBEAT_MAX_AGE_MS;
  } catch {
    return false;
  }
}

function createStageChannel() {
  if (!('BroadcastChannel' in window)) return null;
  return new BroadcastChannel(STAGE_CHANNEL_NAME);
}

function getPublisherChannel() {
  if (publisherChannel !== undefined) return publisherChannel;
  publisherChannel = createStageChannel();
  return publisherChannel;
}
