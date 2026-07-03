import type { PresentationStage, StageNarration, StageSpeech, WorldMapState, WorldOverview } from '../types';

export const STAGE_CHANNEL_NAME = 'newchat.stage.v1';
export const STAGE_SNAPSHOT_STORAGE_KEY = 'newchat.stage.snapshot.v1';
export const STAGE_COMMAND_CHANNEL_NAME = 'newchat.stage.command.v1';
export const STAGE_COMMAND_STORAGE_KEY = 'newchat.stage.command.v1';
export const STAGE_COMMAND_ACK_CHANNEL_NAME = 'newchat.stage.commandAck.v1';
export const STAGE_COMMAND_ACK_STORAGE_KEY = 'newchat.stage.commandAck.v1';
export const STAGE_COMMAND_ACK_TIMEOUT_MS = 800;
const STAGE_SOURCE_HEARTBEAT_STORAGE_KEY = 'newchat.stage.sourceHeartbeat.v1';
const STAGE_SOURCE_HEARTBEAT_MAX_AGE_MS = 30_000;

let publisherChannel: BroadcastChannel | null | undefined;
let commandPublisherChannel: BroadcastChannel | null | undefined;
let commandAckPublisherChannel: BroadcastChannel | null | undefined;

export interface StageLogEntry {
  id: string;
  role: 'player' | 'dm' | 'npc' | 'system';
  text: string;
}

export interface StageSnapshot {
  stage: PresentationStage | null;
  world: WorldOverview | null;
  worldMap: WorldMapState | null;
  activeStageSpeech: StageSpeech | null;
  activeStageNarration: StageNarration | null;
  recentLogEntries: StageLogEntry[];
  isActionPending: boolean;
  isLoading: boolean;
  isWorldMapLoading: boolean;
  updatedAt: number;
}

export interface StageCommand {
  id: string;
  content: string;
  createdAt: number;
  expiresAt: number;
}

export type StageCommandAckStatus = 'accepted' | 'rejected';

export interface StageCommandAck {
  commandId: string;
  receivedAt: number;
  status: StageCommandAckStatus;
  reason?: string;
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

export function publishStageCommand(content: string) {
  const createdAt = Date.now();
  const command: StageCommand = {
    id: `${createdAt}-${Math.random().toString(16).slice(2)}`,
    content,
    createdAt,
    expiresAt: createdAt + STAGE_COMMAND_ACK_TIMEOUT_MS,
  };
  const serialized = JSON.stringify(command);
  try {
    window.localStorage.setItem(STAGE_COMMAND_STORAGE_KEY, serialized);
  } catch {
    // BroadcastChannel still covers the normal same-browser flow.
  }
  getCommandPublisherChannel()?.postMessage(command);
  return command;
}

export function publishStageCommandAck(
  commandId: string,
  status: StageCommandAckStatus = 'accepted',
  reason?: string,
) {
  const ack: StageCommandAck = {
    commandId,
    receivedAt: Date.now(),
    status,
    reason,
  };
  const serialized = JSON.stringify(ack);
  try {
    window.localStorage.setItem(STAGE_COMMAND_ACK_STORAGE_KEY, serialized);
  } catch {
    // BroadcastChannel still covers the normal same-browser flow.
  }
  getCommandAckPublisherChannel()?.postMessage(ack);
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

export function subscribeStageCommand(callback: (command: StageCommand) => void) {
  const channel = createCommandChannel();
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STAGE_COMMAND_STORAGE_KEY || !event.newValue) return;
    try {
      callback(JSON.parse(event.newValue) as StageCommand);
    } catch {
      // Ignore malformed commands from older tabs.
    }
  };

  channel?.addEventListener('message', (event) => callback(event.data as StageCommand));
  window.addEventListener('storage', handleStorage);

  return () => {
    channel?.close();
    window.removeEventListener('storage', handleStorage);
  };
}

export function subscribeStageCommandAck(callback: (ack: StageCommandAck) => void) {
  const channel = createCommandAckChannel();
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STAGE_COMMAND_ACK_STORAGE_KEY || !event.newValue) return;
    try {
      callback(JSON.parse(event.newValue) as StageCommandAck);
    } catch {
      // Ignore malformed acknowledgements from older tabs.
    }
  };

  channel?.addEventListener('message', (event) => callback(event.data as StageCommandAck));
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

function createCommandChannel() {
  if (!('BroadcastChannel' in window)) return null;
  return new BroadcastChannel(STAGE_COMMAND_CHANNEL_NAME);
}

function createCommandAckChannel() {
  if (!('BroadcastChannel' in window)) return null;
  return new BroadcastChannel(STAGE_COMMAND_ACK_CHANNEL_NAME);
}

function getPublisherChannel() {
  if (publisherChannel !== undefined) return publisherChannel;
  publisherChannel = createStageChannel();
  return publisherChannel;
}

function getCommandPublisherChannel() {
  if (commandPublisherChannel !== undefined) return commandPublisherChannel;
  commandPublisherChannel = createCommandChannel();
  return commandPublisherChannel;
}

function getCommandAckPublisherChannel() {
  if (commandAckPublisherChannel !== undefined) return commandAckPublisherChannel;
  commandAckPublisherChannel = createCommandAckChannel();
  return commandAckPublisherChannel;
}
