import { Pin } from 'lucide-react';
import { formatTime } from '../lib/chat';
import type { FixedContext } from '../types';

interface FixedContextStatusProps {
  fixedContext: FixedContext;
  onOpenSettings: () => void;
}

export function FixedContextStatus({ fixedContext, onOpenSettings }: FixedContextStatusProps) {
  if (!fixedContext.content.trim()) return null;

  return (
    <button className="fixed-context-status" type="button" onClick={onOpenSettings}>
      <span className="fixed-context-icon" aria-hidden="true">
        <Pin size={15} />
      </span>
      <span className="fixed-context-copy">
        <strong>固定上下文已启用</strong>
        <small>来自 fixed-context.md · {fixedContext.updatedAt ? formatTime(fixedContext.updatedAt) : '未写入'}</small>
      </span>
    </button>
  );
}
