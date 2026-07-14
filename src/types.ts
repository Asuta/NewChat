export type Role = 'user' | 'assistant' | 'system';
export type ThinkingMode = 'enabled' | 'disabled';
export type ModelId = 'deepseek-v4-flash' | 'deepseek-v4-pro';
export type ContextMode = 'summary-only' | 'summary-recent' | 'full-history';
export type DisplayMode = 'chat' | 'game';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  kind?: 'scene-transition' | 'action-result' | 'npc-speech' | 'agent-step' | 'assistant-reasoning';
  status?: 'streaming' | 'done' | 'error';
  agentRunId?: number;
  agentSteps?: AgentStep[];
  modelTranscript?: AgentModelTranscriptMessage[];
  npcSpeech?: {
    entityId: string;
    name: string;
  };
  sceneTransition?: {
    fromSceneId?: string | null;
    fromSceneName: string;
    toSceneId?: string | null;
    toSceneName: string;
    elapsedMinutes?: number;
    timeLabel?: string;
  };
  actionResult?: ActionResult;
  agentStep?: AgentStep;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  contextSummary?: ContextSummary;
  contextMode?: ContextMode;
}

export interface HealthState {
  ok: boolean;
  providerConfigured: boolean;
  mock: boolean;
  model: ModelId | string | null;
  baseURL: string;
  thinking: ThinkingMode | null;
  availableModels: ModelId[];
}

export interface ContextSummary {
  content: string;
  compressedAt: number;
  messageCount: number;
  lastMessageId: string | null;
}

export interface FixedContextFile {
  name: string;
  order: number;
  content: string;
  updatedAt: number | null;
}

export interface FixedContext {
  content: string;
  editableContent: string;
  updatedAt: number | null;
  files: FixedContextFile[];
}

export type EntityKind = 'player' | 'character' | 'scene' | 'item' | 'quest' | 'event' | 'faction' | 'lore';

export interface WorldEntity {
  id: string;
  kind: EntityKind;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  aliases?: string[];
  locationId?: string | null;
}

export interface WorldRelationship {
  id: number;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  value: number | null;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WorldSceneState {
  playerId: string;
  scene: WorldEntity | null;
  sceneComponent: {
    description?: string;
    exits?: string[];
    tags?: string[];
    visibility?: string;
  } | null;
  residents: WorldEntity[];
  items: WorldEntity[];
  events: WorldEntity[];
  exits: Array<{
    relationship: WorldRelationship;
    scene: WorldEntity;
  }>;
  relatedLore: WorldEntity[];
}

export interface WorldClockState {
  absoluteMinutes: number;
  day: number;
  minuteOfDay: number;
  label: string;
  dayLabel: string;
  fullLabel: string;
}

export interface SceneVisitState {
  id: string;
  sceneId: string;
  sceneName: string;
  enteredAt: number;
  enteredAtLabel: string;
  elapsedMinutes: number;
  previousVisitId?: string | null;
  leftAt?: number;
  leftAtLabel?: string;
  summary?: string;
  reason?: string;
}

export interface WorldTimeCheckpointState {
  absoluteMinutes: number;
  conversationCursor: number;
  sceneId: string;
  sceneName: string;
  reason: string;
  summary: string;
  updatedAt: string;
  clock: WorldClockState;
}

export interface WorldTimeState {
  clock: WorldClockState;
  checkpoint: WorldTimeCheckpointState;
  pendingEventCount: number;
  currentSceneVisit: SceneVisitState;
}

export interface WorldOverview {
  currentScene: WorldSceneState;
  time?: WorldTimeState;
  counts: {
    entities: number;
    scenes: number;
    characters: number;
    items: number;
    relationships: number;
  };
  recentAgentRuns: AgentRun[];
}

export interface PresentationStageCharacter {
  entityId: string;
  name: string;
  kind: EntityKind;
  health: {
    currentHitPoints: number;
    maxHitPoints: number;
  } | null;
  vitalState: 'active' | 'incapacitated' | 'dead';
  portraitUrl: string | null;
  position: string;
  slot: 'left' | 'center' | 'right' | string;
  scale: number;
  hasBinding: boolean;
  isFallbackPortrait: boolean;
}

export interface PresentationStage {
  scene: {
    id: string;
    name: string;
    description: string;
  } | null;
  backgroundUrl: string | null;
  characters: PresentationStageCharacter[];
  hiddenCharacterCount: number;
}

export interface StageSpeech {
  entityId: string;
  name: string;
  content: string;
  createdAt: number;
}

export interface StageNarration {
  content: string;
  createdAt: number;
  runId?: number;
  messageId?: string;
}

export interface StageDialogueEntry {
  id: string;
  kind: 'narration' | 'speech';
  speakerId?: string;
  speakerName?: string;
  content: string;
  status: 'streaming' | 'complete';
  runId?: number;
}

export interface WorldMapScene {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface WorldMapLink {
  sourceSceneId: string;
  targetSceneId: string;
}

export interface WorldMapState {
  currentSceneId: string;
  scenes: WorldMapScene[];
  links: WorldMapLink[];
}

export interface WorldActionMenuTarget {
  entityId: string;
  entityName: string;
  clientX: number;
  clientY: number;
}

export interface AttackWorldAction {
  id: string;
  kind: 'attack.weapon';
  label: string;
  actorId: string;
  actorName?: string;
  targetId: string;
  targetName?: string;
  weaponId: string;
  weaponName: string;
}

export type InventoryActionKind =
  | 'item.equip'
  | 'item.unequip'
  | 'item.use'
  | 'item.present'
  | 'item.drop'
  | 'item.pickup';

export interface InventoryAction {
  id: string;
  kind: InventoryActionKind;
  label: string;
  actorId: string;
  itemId: string;
  targetId?: string;
  targetMode: 'none' | 'self_or_character' | 'optional_character';
  requiresTarget: boolean;
  validTargetIds: string[];
  disabledReason: string | null;
  danger: boolean;
}

export interface InventoryTarget {
  id: string;
  name: string;
  kind: EntityKind;
  vitalState: 'active' | 'incapacitated' | 'dead';
  health: {
    currentHitPoints: number;
    maxHitPoints: number;
  } | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  equipped: boolean;
  category: 'weapon' | 'consumable' | 'tool' | 'quest' | 'clue' | string;
  identity: {
    role?: string;
    description?: string;
    effect?: Record<string, unknown>;
    [key: string]: unknown;
  };
  rules: {
    category: string;
    stackable: boolean;
    droppable: boolean;
    equipSlot: string | null;
    use: Record<string, unknown> | null;
  };
  actions: InventoryAction[];
}

export interface PlayerInventory {
  actor: { id: string; name: string };
  gold: number;
  equippedWeaponId: string | null;
  totalQuantity: number;
  items: InventoryItem[];
  nearbyItems: InventoryItem[];
  targets: InventoryTarget[];
}

export type WorldAction = AttackWorldAction | InventoryAction;

export interface ActionResult {
  type: string;
  action?: WorldAction;
  facts: Record<string, unknown>;
  stateChanges: Array<Record<string, unknown>>;
  narrationHints: Record<string, unknown>;
  summary: string;
}

export interface ExecuteWorldActionResponse {
  ok: boolean;
  eventId: number;
  result: ActionResult;
  world: WorldOverview;
  inventory?: PlayerInventory;
}

export interface EntityBundle {
  entity: WorldEntity;
  aliases: string[];
  components: Record<string, unknown>;
  relationships: WorldRelationship[];
  events: Array<{
    id: number;
    type: string;
    actorId: string | null;
    targetId: string | null;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
}

export interface AgentStep {
  index?: number;
  stepIndex?: number;
  tool: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface AgentModelTranscriptMessage {
  role: 'assistant' | 'tool';
  content: string;
  reasoning_content?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

export type AgentContextEvent =
  | {
      type: 'summary';
      content: string;
    }
  | {
      type: 'message';
      role: Role;
      content: string;
    }
  | {
      type: 'scene_transition';
      content: string;
      fromSceneId?: string | null;
      fromSceneName?: string;
      toSceneId?: string | null;
      toSceneName?: string;
      elapsedMinutes?: number;
      timeLabel?: string;
    }
  | {
      type: 'action_result';
      summary: string;
      result: ActionResult;
    }
  | {
      type: 'agent_step';
      runId?: number;
      stepIndex?: number;
      tool: string;
      args: Record<string, unknown>;
      result: Record<string, unknown>;
    }
  | {
      type: 'model_message';
      message: AgentModelTranscriptMessage;
    };

export interface AgentRun {
  id: number;
  prompt: string;
  status: string;
  answer: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  steps?: AgentStep[];
}

export interface LoggedModelMessage {
  role: Role | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: LoggedToolCall[];
  reasoningContentLength?: number;
}

export interface LoggedToolCall {
  id?: string;
  name?: string;
  arguments?: unknown;
}

export interface LoggedToolResult {
  toolCallId?: string;
  tool?: string;
  result?: unknown;
}

export interface ModelRequestUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
    [key: string]: number | undefined;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
    [key: string]: number | undefined;
  };
  [key: string]: unknown;
}

export interface ModelRequestLogEntry {
  kind?: 'tool-plan' | 'final-answer';
  mode?: 'json' | 'native-tools';
  stepIndex: number;
  model: string | null;
  thinking: ThinkingMode | null;
  createdAt: number;
  maxSteps?: number;
  messages: LoggedModelMessage[];
  content?: string;
  nativeTools?: string[];
  toolCalls?: LoggedToolCall[];
  toolResults?: LoggedToolResult[];
  reasoningContentLength?: number;
  parseError?: string;
  parseRepairAttempt?: number;
  usage?: ModelRequestUsage | null;
}

export interface ModelRequestLog {
  entries: ModelRequestLogEntry[];
}

export interface WorldAgentResponse {
  answer: string;
  runId: number;
  steps: AgentStep[];
  modelTranscript?: AgentModelTranscriptMessage[];
  world: WorldOverview;
  requestLog?: ModelRequestLog;
}

export type SaveExportMode = 'template' | 'full';

export interface SaveDataResponse {
  world: WorldOverview;
  fixedContext: FixedContext;
  conversations?: Conversation[] | null;
}

export type WorldAgentStreamEvent =
  | {
      type: 'start';
      runId: number;
    }
  | {
      type: 'step';
      step: AgentStep;
    }
  | {
      type: 'assistant_text_start';
      runId?: number;
      stepIndex?: number;
    }
  | {
      type: 'assistant_reasoning_start';
      runId?: number;
      stepIndex?: number;
    }
  | {
      type: 'assistant_reasoning_delta';
      delta: string;
    }
  | {
      type: 'assistant_text_delta';
      delta: string;
    }
  | {
      type: 'npc_speech_start';
      npcEntityId: string;
      npcName: string;
      runId?: number;
      stepIndex?: number;
    }
  | {
      type: 'npc_speech_delta';
      npcEntityId: string;
      npcName: string;
      delta: string;
      runId?: number;
      stepIndex?: number;
    }
  | {
      type: 'npc_speech';
      npcEntityId: string;
      npcName: string;
      content: string;
      runId?: number;
      stepIndex?: number;
    }
  | {
      type: 'done';
      answer: string;
      runId: number;
      steps: AgentStep[];
      modelTranscript?: AgentModelTranscriptMessage[];
      world: WorldOverview;
      requestLog?: ModelRequestLog;
    }
  | {
      type: 'error';
      error: string;
    };
