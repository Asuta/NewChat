import { Archive, Brain, ChevronDown, Gamepad2, Loader2, MessageSquare, MoreHorizontal, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import type {
  ContextMode,
  Conversation,
  DisplayMode,
  FixedContext,
  HealthState,
  ModelId,
  ModelRequestLog,
  SaveExportMode,
  ThinkingMode,
} from '../types';
import { ConversationSettingsPanel } from './ConversationSettingsPanel';

const MODEL_OPTIONS: Array<{ id: ModelId; label: string; description: string }> = [
  { id: 'deepseek-v4-flash', label: 'Flash', description: '更快，适合日常聊天' },
  { id: 'deepseek-v4-pro', label: 'Pro', description: '更强，适合复杂任务' },
];

const CONTEXT_MODE_OPTIONS: Array<{ id: ContextMode; label: string; description: string }> = [
  { id: 'summary-only', label: '仅摘要', description: '只发送摘要和压缩后的新消息' },
  { id: 'summary-recent', label: '摘要+最近', description: '摘要外再保留最近 3 轮原文' },
  { id: 'full-history', label: '完整历史', description: '按未压缩方式发送全部历史' },
];

interface TopBarProps {
  conversation: Conversation;
  health: HealthState | null;
  modelId: ModelId;
  displayMode: DisplayMode;
  thinkingMode: ThinkingMode;
  contextMode: ContextMode;
  fixedContext: FixedContext;
  requestLog: ModelRequestLog | null;
  isStreaming: boolean;
  isCompressing: boolean;
  isFixedContextSaving: boolean;
  isSaveDataBusy: boolean;
  canCompress: boolean;
  isSettingsOpen: boolean;
  onModelChange: (model: ModelId) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onThinkingModeChange: (mode: ThinkingMode) => void;
  onContextModeChange: (mode: ContextMode) => void;
  onCompress: () => void;
  onSettingsOpenChange: (open: boolean) => void;
  onSaveFixedContext: (content: string) => void;
  onClearFixedContext: () => void;
  onClearChat: () => void;
  onResetSaveData: () => void;
  onExportSaveData: (mode: SaveExportMode) => void;
  onImportSaveData: (file: File) => void;
}

export function TopBar({
  conversation,
  health,
  modelId,
  displayMode,
  thinkingMode,
  contextMode,
  fixedContext,
  requestLog,
  isStreaming,
  isCompressing,
  isFixedContextSaving,
  isSaveDataBusy,
  canCompress,
  isSettingsOpen,
  onModelChange,
  onDisplayModeChange,
  onThinkingModeChange,
  onContextModeChange,
  onCompress,
  onSettingsOpenChange,
  onSaveFixedContext,
  onClearFixedContext,
  onClearChat,
  onResetSaveData,
  onExportSaveData,
  onImportSaveData,
}: TopBarProps) {
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const label = health?.mock ? 'Mock 本地' : modelId || health?.model || '未配置模型';
  const configured = Boolean(health?.providerConfigured || health?.mock);
  const thinkingEnabled = thinkingMode === 'enabled';
  const contextModeLabel = CONTEXT_MODE_OPTIONS.find((option) => option.id === contextMode)?.label || '仅摘要';
  const controlsDisabled = isStreaming || isCompressing || isFixedContextSaving || isSaveDataBusy;

  return (
    <header className="topbar">
      <button className="title-button" type="button">
        {conversation.title}
        <ChevronDown size={18} />
      </button>
      <div className="topbar-actions">
        <div className="view-toggle" role="group" aria-label="切换表现方式">
          <button
            className={displayMode === 'chat' ? 'active' : ''}
            type="button"
            aria-pressed={displayMode === 'chat'}
            title="聊天视图"
            onClick={() => onDisplayModeChange('chat')}
          >
            <MessageSquare size={16} />
            <span>聊天</span>
          </button>
          <button
            className={displayMode === 'game' ? 'active' : ''}
            type="button"
            aria-pressed={displayMode === 'game'}
            title="游戏视图"
            onClick={() => onDisplayModeChange('game')}
          >
            <Gamepad2 size={16} />
            <span>游戏</span>
          </button>
        </div>
        <div className="model-menu">
          <button
            className={`model-chip ${modelMenuOpen ? 'open' : ''}`}
            type="button"
            aria-expanded={modelMenuOpen}
            aria-haspopup="menu"
            disabled={controlsDisabled}
            title={controlsDisabled ? '忙碌中不能切换模型' : health?.baseURL || '切换模型'}
            onClick={() => setModelMenuOpen((open) => !open)}
          >
            <span className={`status-dot ${configured ? 'ready' : 'warning'}`} />
            {label}
            <ChevronDown size={16} />
          </button>
          {modelMenuOpen ? (
            <div className="model-menu-panel" role="menu" aria-label="模型选择">
              {MODEL_OPTIONS.map((option) => (
                <button
                  className={`model-option ${option.id === modelId ? 'selected' : ''}`}
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={option.id === modelId}
                  onClick={() => {
                    onModelChange(option.id);
                    setModelMenuOpen(false);
                  }}
                >
                  <span>{option.id}</span>
                  <small>{option.description}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          className={`thinking-toggle ${thinkingEnabled ? 'active' : ''}`}
          type="button"
          aria-pressed={thinkingEnabled}
          aria-label={thinkingEnabled ? '关闭思考' : '开启思考'}
          disabled={controlsDisabled}
          title={controlsDisabled ? '忙碌中不能切换思考模式' : '切换 DeepSeek 思考模式'}
          onClick={() => onThinkingModeChange(thinkingEnabled ? 'disabled' : 'enabled')}
        >
          <Brain size={17} />
          <span>思考</span>
          <strong>{thinkingEnabled ? '开' : '关'}</strong>
        </button>
        <button
          className="compact-button"
          type="button"
          disabled={!canCompress || controlsDisabled}
          title={!canCompress ? '当前会话没有可压缩内容' : '压缩当前会话上下文'}
          onClick={onCompress}
        >
          {isCompressing ? <Loader2 className="spin" size={17} /> : <Archive size={17} />}
          <span>{isCompressing ? '压缩中' : '压缩'}</span>
        </button>
        <div className="model-menu context-menu">
          <button
            className={`context-chip ${contextMenuOpen ? 'open' : ''}`}
            type="button"
            aria-expanded={contextMenuOpen}
            aria-haspopup="menu"
            disabled={controlsDisabled}
            title={controlsDisabled ? '忙碌中不能切换上下文策略' : '切换上下文发送策略'}
            onClick={() => setContextMenuOpen((open) => !open)}
          >
            <SlidersHorizontal size={17} />
            <span className="context-prefix">上下文</span>
            <strong>{contextModeLabel}</strong>
            <ChevronDown size={15} />
          </button>
          {contextMenuOpen ? (
            <div className="model-menu-panel context-menu-panel" role="menu" aria-label="上下文策略">
              {CONTEXT_MODE_OPTIONS.map((option) => (
                <button
                  className={`model-option ${option.id === contextMode ? 'selected' : ''}`}
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={option.id === contextMode}
                  onClick={() => {
                    onContextModeChange(option.id);
                    setContextMenuOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  <small>{option.description}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          className={`icon-button ${isSettingsOpen ? 'active' : ''}`}
          type="button"
          aria-label="更多"
          aria-expanded={isSettingsOpen}
          aria-haspopup="dialog"
          onClick={() => {
            setModelMenuOpen(false);
            setContextMenuOpen(false);
            onSettingsOpenChange(!isSettingsOpen);
          }}
        >
          <MoreHorizontal size={20} />
        </button>
      </div>
      {isSettingsOpen ? (
        <ConversationSettingsPanel
          conversation={conversation}
          fixedContext={fixedContext}
          requestLog={requestLog}
          disabled={controlsDisabled}
          onClose={() => onSettingsOpenChange(false)}
          onSaveFixedContext={onSaveFixedContext}
          onClearFixedContext={onClearFixedContext}
          onClearChat={onClearChat}
          onResetSaveData={onResetSaveData}
          onExportSaveData={onExportSaveData}
          onImportSaveData={onImportSaveData}
          isSaveDataBusy={isSaveDataBusy}
        />
      ) : null}
    </header>
  );
}
