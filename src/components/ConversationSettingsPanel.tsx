import { Download, Eraser, FileText, Pin, RotateCcw, Save, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Conversation, FixedContext, ModelRequestLog, SaveExportMode } from '../types';

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
                  <span>Step {entry.stepIndex}</span>
                  <small>{entry.model || '未配置模型'} · {entry.thinking || 'thinking unset'} · {formatLogTime(entry.createdAt)}</small>
                </summary>
                <div className="model-request-messages">
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

function formatLogTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp);
}
