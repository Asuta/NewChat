import { Bot, CircleAlert } from 'lucide-react';
import { Fragment, useEffect, useRef } from 'react';
import type { Conversation, FixedContext } from '../types';
import { AgentStepsTimelineItem } from './AgentStepsTimelineItem';
import { ContextSummaryBar } from './ContextSummaryBar';
import { FixedContextStatus } from './FixedContextStatus';
import { MessageBubble } from './MessageBubble';

interface ChatThreadProps {
  conversation: Conversation;
  error: string | null;
  fixedContext: FixedContext;
  onOpenSettings: () => void;
}

export function ChatThread({ conversation, error, fixedContext, onOpenSettings }: ChatThreadProps) {
  const { messages } = conversation;
  const threadRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const summary = conversation.contextSummary;
  const lastMessage = messages[messages.length - 1];

  function scrollToBottom() {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }

  function updateStickiness() {
    const thread = threadRef.current;
    if (!thread) return;
    const distanceToBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
    shouldStickToBottomRef.current = distanceToBottom < 80;
  }

  function preserveAnchorAfterTimelineResize(anchor: HTMLElement) {
    const thread = threadRef.current;
    if (!thread) return;

    shouldStickToBottomRef.current = false;
    const anchorTop = anchor.getBoundingClientRect().top;

    const preserveAnchor = () => {
      const nextTop = anchor.getBoundingClientRect().top;
      thread.scrollTop += nextTop - anchorTop;
    };

    requestAnimationFrame(() => {
      preserveAnchor();
      requestAnimationFrame(preserveAnchor);
    });
    window.setTimeout(preserveAnchor, 120);
    window.setTimeout(preserveAnchor, 260);
    window.setTimeout(preserveAnchor, 500);
  }

  useEffect(() => {
    scrollToBottom();
  }, [error, fixedContext.updatedAt, lastMessage?.content, lastMessage?.status, messages.length, summary?.compressedAt]);

  useEffect(() => {
    const thread = threadRef.current;
    const inner = innerRef.current;
    if (!thread || !inner) return;

    const observer = new ResizeObserver(() => {
      if (shouldStickToBottomRef.current) {
        requestAnimationFrame(scrollToBottom);
      }
    });

    observer.observe(inner);
    thread.addEventListener('scroll', updateStickiness, { passive: true });

    return () => {
      observer.disconnect();
      thread.removeEventListener('scroll', updateStickiness);
    };
  }, []);

  const summaryAnchorFound = summary?.lastMessageId
    ? messages.some((message) => message.id === summary.lastMessageId)
    : false;

  return (
    <div className="thread-scroll" ref={threadRef}>
      <div className="thread-inner" ref={innerRef}>
        <FixedContextStatus fixedContext={fixedContext} onOpenSettings={onOpenSettings} />

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
                {message.role === 'assistant' && message.agentSteps?.length ? (
                  <AgentStepsTimelineItem
                    runId={message.agentRunId}
                    steps={message.agentSteps}
                    onLayoutChange={preserveAnchorAfterTimelineResize}
                  />
                ) : null}
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
