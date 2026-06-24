export type Role = 'user' | 'assistant' | 'system';
export type ThinkingMode = 'enabled' | 'disabled';
export type ModelId = 'deepseek-v4-flash' | 'deepseek-v4-pro';
export type ContextMode = 'summary-only' | 'summary-recent' | 'full-history';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  status?: 'streaming' | 'done' | 'error';
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
