import { FileText, Sparkles } from 'lucide-react';
import { formatTime, getConversationContextMode } from '../lib/chat';
import type { Conversation, ContextMode } from '../types';

const MODE_LABELS: Record<ContextMode, string> = {
  'summary-only': '仅摘要',
  'summary-recent': '摘要+最近',
  'full-history': '完整历史',
};

interface ContextSummaryBarProps {
  conversation: Conversation;
}

export function ContextSummaryBar({ conversation }: ContextSummaryBarProps) {
  const summary = conversation.contextSummary;
  if (!summary) return null;

  return (
    <section className="context-summary-bar" aria-label="上下文摘要">
      <div className="context-summary-icon" aria-hidden="true">
        <Sparkles size={17} />
      </div>
      <div className="context-summary-copy">
        <div className="context-summary-title">
          <strong>已压缩上下文</strong>
          <span>{MODE_LABELS[getConversationContextMode(conversation)]}</span>
          <span>{summary.messageCount} 条消息</span>
          <time>{formatTime(summary.compressedAt)}</time>
        </div>
        <p>
          <FileText size={14} />
          {summary.content}
        </p>
      </div>
    </section>
  );
}
