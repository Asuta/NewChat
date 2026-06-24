import { Pin } from 'lucide-react';
import { formatTime } from '../lib/chat';
import type { Conversation } from '../types';

interface FixedContextStatusProps {
  conversation: Conversation;
  onOpenSettings: () => void;
}

export function FixedContextStatus({ conversation, onOpenSettings }: FixedContextStatusProps) {
  const fixedContext = conversation.fixedContext;
  if (!fixedContext?.content.trim()) return null;

  return (
    <button className="fixed-context-status" type="button" onClick={onOpenSettings}>
      <span className="fixed-context-icon" aria-hidden="true">
        <Pin size={15} />
      </span>
      <span className="fixed-context-copy">
        <strong>固定上下文已启用</strong>
        <small>每次请求都会置于最顶部 · {formatTime(fixedContext.updatedAt)}</small>
      </span>
    </button>
  );
}
