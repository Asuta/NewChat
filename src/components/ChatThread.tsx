import { Bot, CircleAlert } from 'lucide-react';
import { Fragment, useEffect, useRef } from 'react';
import type { Conversation } from '../types';
import { ContextSummaryBar } from './ContextSummaryBar';
import { MessageBubble } from './MessageBubble';

interface ChatThreadProps {
  conversation: Conversation;
  error: string | null;
}

export function ChatThread({ conversation, error }: ChatThreadProps) {
  const { messages } = conversation;
  const threadRef = useRef<HTMLDivElement>(null);
  const summary = conversation.contextSummary;
  const lastMessage = messages[messages.length - 1];

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [error, lastMessage?.content, lastMessage?.status, messages.length, summary?.compressedAt]);

  const summaryAnchorFound = summary?.lastMessageId
    ? messages.some((message) => message.id === summary.lastMessageId)
    : false;

  return (
    <div className="thread-scroll" ref={threadRef}>
      <div className="thread-inner">
        {messages.length === 0 ? (
          <section className="empty-state">
            <div className="assistant-avatar large">
              <Bot size={28} />
            </div>
            <h1>开始一个新对话</h1>
            <p>输入你的问题，NewChat 会通过后端大模型流式返回回答。</p>
          </section>
        ) : (
          messages.map((message, index) => {
            const shouldRenderSummary =
              Boolean(summary) &&
              ((summaryAnchorFound && message.id === summary?.lastMessageId) ||
                (!summaryAnchorFound && index === messages.length - 1));

            return (
              <Fragment key={message.id}>
                <MessageBubble message={message} />
                {shouldRenderSummary ? <ContextSummaryBar conversation={conversation} /> : null}
              </Fragment>
            );
          })
        )}

        {error ? (
          <div className="error-line" role="alert">
            <CircleAlert size={17} />
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
