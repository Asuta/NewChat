import { Download, Eraser, FileText, Pin, RotateCcw, Save, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Conversation, FixedContext, ModelRequestLog, ModelRequestLogEntry, ModelRequestUsage, SaveExportMode } from '../types';

interface ConversationSettingsPanelProps {
  conversation: Conversation;
  fixedContext: FixedContext;
  requestLog: ModelRequestLog | null;
  disabled: boolean;
  onClose: () => void;
  onClearChat: () => void;
  onClearFixedContext: () => void;
  onExportSaveData: (mode: SaveExportMode) => void;
  onImportSaveData: (file: File) => void;
  onResetSaveData: () => void;
  onSaveFixedContext: (content: string) => void;
  isSaveDataBusy: boolean;
}

export function ConversationSettingsPanel({
  conversation,
  fixedContext,
  requestLog,
  disabled,
  onClose,
  onClearChat,
  onClearFixedContext,
  onExportSaveData,
  onImportSaveData,
  onResetSaveData,
  onSaveFixedContext,
  isSaveDataBusy,
}: ConversationSettingsPanelProps) {
  const [value, setValue] = useState(fixedContext.editableContent);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setValue(fixedContext.editableContent);
  }, [fixedContext.editableContent]);

  const hasEditableContext = Boolean(fixedContext.editableContent.trim());
  const hasDynamicChat = conversation.messages.length > 0 || Boolean(conversation.contextSummary);
  const canSave = !disabled && value !== fixedContext.editableContent;

  return (
    <div className="settings-panel" role="dialog" aria-label="会话设置">
      <div className="settings-panel-header">
        <div>
          <strong>会话设置</strong>
          <span>{conversation.title}</span>
        </div>
        <button className="icon-button ghost" type="button" aria-label="关闭设置" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <label className="fixed-context-field">
        <span>
          <Pin size={16} />
          用户固定上下文
        </span>
        <textarea
          aria-label="用户固定上下文"
          placeholder="输入所有对话每次都需要携带的固定背景、角色设定、约束或长期目标。"
          rows={8}
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>

      <div className="settings-actions">
        <button className="settings-primary" type="button" disabled={!canSave} onClick={() => onSaveFixedContext(value)}>
          <Save size={16} />
          保存固定上下文
        </button>
        <button className="settings-secondary" type="button" disabled={disabled || !hasEditableContext} onClick={onClearFixedContext}>
          <Eraser size={16} />
          清空用户上下文
        </button>
      </div>

      <section className="fixed-context-pack" aria-label="固定上下文文档包">
        <div className="fixed-context-pack-header">
          <div>
            <strong>已加载固定上下文文档</strong>
            <span>{fixedContext.files.length ? `${fixedContext.files.length} 个文档按文件名前缀排序` : '还没有可加载文档'}</span>
          </div>
          <FileText size={18} />
        </div>

        <div className="fixed-context-file-list">
          {fixedContext.files.map((file) => (
            <article className="fixed-context-file" key={file.name}>
              <span>{String(file.order).padStart(3, '0')}</span>
              <strong>{file.name}</strong>
              <small>{file.content.trim() ? `${file.content.trim().length} 字符` : '空文档'}</small>
            </article>
          ))}
        </div>

        <details className="fixed-context-preview">
          <summary>查看合并预览</summary>
          <pre>{fixedContext.content.trim() || '暂无固定上下文内容。'}</pre>
        </details>
      </section>

      <section className="save-data-panel" aria-label="数据管理">
        <div className="save-data-panel-header">
          <div>
            <strong>数据管理</strong>
            <span>当前游玩只写入 data/save，可重置回 data/template 或导入导出世界包。</span>
          </div>
          <FileText size={18} />
        </div>

        <div className="save-data-actions">
          <button className="settings-danger" type="button" disabled={disabled || isSaveDataBusy} onClick={onResetSaveData}>
            <RotateCcw size={16} />
            重置当前存档
          </button>
          <button className="settings-secondary" type="button" disabled={disabled || isSaveDataBusy} onClick={() => onExportSaveData('template')}>
            <Download size={16} />
            导出基础世界
          </button>
          <button className="settings-secondary" type="button" disabled={disabled || isSaveDataBusy} onClick={() => onExportSaveData('full')}>
            <Download size={16} />
            导出完整存档
          </button>
          <button
            className="settings-secondary"
            type="button"
            disabled={disabled || isSaveDataBusy}
            onClick={() => importInputRef.current?.click()}
          >
            <Upload size={16} />
            导入世界包
          </button>
          <input
            ref={importInputRef}
            className="hidden-file-input"
            type="file"
            accept=".json,.newchat-save.json,application/json"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) onImportSaveData(file);
            }}
          />
        </div>
      </section>

      <section className="model-request-log" aria-label="上一轮模型请求 Log">
        <div className="model-request-log-header">
          <div>
            <strong>上一轮模型请求 Log</strong>
            <span>{requestLog?.entries.length ? `${requestLog.entries.length} 次大模型请求` : '还没有记录到模型请求'}</span>
          </div>
          <FileText size={18} />
        </div>

        {requestLog?.entries.length ? (
          <div className="model-request-log-list">
            {requestLog.entries.map((entry) => (
              <details className="model-request-entry" key={`${entry.stepIndex}-${entry.createdAt}`}>
                <summary>
                  <span>{formatRequestEntryTitle(entry)}</span>
                  <small>
                    {entry.model || '未配置模型'} · {entry.thinking || 'thinking unset'} · {formatUsageSummary(entry.usage)} · {formatLogTime(entry.createdAt)}
                  </small>
                </summary>
                <div className="model-request-messages">
                  <ModelUsageSummary usage={entry.usage} />
                  {entry.messages.map((message, index) => (
                    <article className="model-request-message" key={`${message.role}-${index}`}>
                      <strong>{message.role}</strong>
                      <pre>{message.content}</pre>
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="model-request-empty">发送一条游戏消息后，这里会显示上一轮实际发给大模型的 system/user 文本。</p>
        )}
      </section>

      <div className="settings-danger-zone">
        <div>
          <strong>清空当前聊天</strong>
          <span>只清空动态消息和压缩摘要，不会修改 data/save/context/001-user-fixed-context.md。</span>
        </div>
        <button className="settings-danger" type="button" disabled={disabled || !hasDynamicChat} onClick={onClearChat}>
          <Trash2 size={16} />
          清空聊天
        </button>
      </div>
    </div>
  );
}

function ModelUsageSummary({ usage }: { usage?: ModelRequestUsage | null }) {
  if (!usage) {
    return <p className="model-request-usage-empty">本次响应没有返回 usage 信息。</p>;
  }

  const cachedTokens = getCachedTokens(usage);
  const metrics = [
    ['Prompt', usage.prompt_tokens],
    ['Completion', usage.completion_tokens],
    ['Total', usage.total_tokens],
    ['Cache hit', getUsageNumber(usage, 'prompt_cache_hit_tokens') ?? cachedTokens],
    ['Cache miss', usage.prompt_cache_miss_tokens],
    ['Reasoning', usage.completion_tokens_details?.reasoning_tokens],
  ].filter((item): item is [string, number] => typeof item[1] === 'number');

  if (!metrics.length) {
    return <p className="model-request-usage-empty">本次响应返回了 usage，但没有可识别的 token 字段。</p>;
  }

  return (
    <div className="model-request-usage" aria-label="模型 token 与缓存统计">
      {metrics.map(([label, value]) => (
        <span key={label}>
          <strong>{label}</strong>
          {value}
        </span>
      ))}
    </div>
  );
}

function formatRequestEntryTitle(entry: ModelRequestLogEntry) {
  return entry.kind === 'final-answer' ? '最终答复' : `Step ${entry.stepIndex}`;
}

function formatUsageSummary(usage?: ModelRequestUsage | null) {
  if (!usage) return '无 usage';
  const cacheHit = getUsageNumber(usage, 'prompt_cache_hit_tokens') ?? getCachedTokens(usage);
  const cacheMiss = usage.prompt_cache_miss_tokens;
  const total = usage.total_tokens;
  const parts = [
    typeof total === 'number' ? `${total} tokens` : null,
    typeof cacheHit === 'number' ? `缓存命中 ${cacheHit}` : null,
    typeof cacheMiss === 'number' ? `未命中 ${cacheMiss}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'usage 已返回';
}

function getCachedTokens(usage: ModelRequestUsage) {
  return usage.prompt_tokens_details?.cached_tokens;
}

function getUsageNumber(usage: ModelRequestUsage, key: keyof ModelRequestUsage) {
  const value = usage[key];
  return typeof value === 'number' ? value : undefined;
}

function formatLogTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp);
}
