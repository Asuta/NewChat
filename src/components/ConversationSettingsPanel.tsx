import { Eraser, Pin, Save, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Conversation, FixedContext } from '../types';

interface ConversationSettingsPanelProps {
  conversation: Conversation;
  fixedContext: FixedContext;
  disabled: boolean;
  onClose: () => void;
  onClearChat: () => void;
  onClearFixedContext: () => void;
  onSaveFixedContext: (content: string) => void;
}

export function ConversationSettingsPanel({
  conversation,
  fixedContext,
  disabled,
  onClose,
  onClearChat,
  onClearFixedContext,
  onSaveFixedContext,
}: ConversationSettingsPanelProps) {
  const [value, setValue] = useState(fixedContext.content);

  useEffect(() => {
    setValue(fixedContext.content);
  }, [fixedContext.content]);

  const hasFixedContext = Boolean(fixedContext.content.trim());
  const hasDynamicChat = conversation.messages.length > 0 || Boolean(conversation.contextSummary);
  const canSave = !disabled && value !== fixedContext.content;

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
          固定上下文
        </span>
        <textarea
          aria-label="固定上下文"
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
        <button className="settings-secondary" type="button" disabled={disabled || !hasFixedContext} onClick={onClearFixedContext}>
          <Eraser size={16} />
          清空固定上下文
        </button>
      </div>

      <div className="settings-danger-zone">
        <div>
          <strong>清空当前聊天</strong>
          <span>只清空动态消息和压缩摘要，不会修改根目录 fixed-context.md。</span>
        </div>
        <button className="settings-danger" type="button" disabled={disabled || !hasDynamicChat} onClick={onClearChat}>
          <Trash2 size={16} />
          清空聊天
        </button>
      </div>
    </div>
  );
}
