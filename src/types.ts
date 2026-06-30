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
  kind?: 'scene-transition' | 'action-result' | 'npc-speech';
  status?: 'streaming' | 'done' | 'error';
  agentRunId?: number;
  agentSteps?: AgentStep[];
  npcSpeech?: {
    entityId: string;
    name: string;
  };
  sceneTransition?: {
    fromSceneId?: string | null;
    fromSceneName: string;
    toSceneId?: string | null;
    toSceneName: string;
  };
  actionResult?: ActionResult;
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

export interface WorldOverview {
  currentScene: WorldSceneState;
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

export interface WorldAction {
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

export interface ActionResult {
  type: 'attack.resolved';
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
  role: Role;
  content: string;
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
  stepIndex: number;
  model: string | null;
  thinking: ThinkingMode | null;
  createdAt: number;
  messages: LoggedModelMessage[];
  content?: string;
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
      type: 'speech_start';
      runId?: number;
      stepIndex?: number;
    }
  | {
      type: 'answer_delta';
      delta: string;
    }
  | {
      type: 'speech_delta';
      delta: string;
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
      world: WorldOverview;
      requestLog?: ModelRequestLog;
    }
  | {
      type: 'error';
      error: string;
    };
