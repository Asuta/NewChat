import { Bot, CheckCheck, Copy, MapPinned, Swords, ThumbsDown, ThumbsUp, UserRound } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { formatTime } from '../lib/chat';
import type { ChatMessage } from '../types';
import { AgentStepTimelineItem } from './AgentStepsTimelineItem';

interface MessageBubbleProps {
  message: ChatMessage;
  onLayoutChange?: (anchor: HTMLElement) => void;
}

export function MessageBubble({ message, onLayoutChange }: MessageBubbleProps) {
  if (message.kind === 'agent-step' && message.agentStep) {
    return (
      <AgentStepTimelineItem
        runId={message.agentRunId}
        step={message.agentStep}
        onLayoutChange={onLayoutChange}
      />
    );
  }

  if (message.kind === 'scene-transition') {
    return (
      <article className="scene-transition-row" aria-label="场景移动记录">
        <div className="scene-transition-pill">
          <MapPinned size={15} />
          <span>{message.content}</span>
          <time>{formatTime(message.createdAt)}</time>
        </div>
      </article>
    );
  }

  if (message.kind === 'action-result') {
    return (
      <article className="action-result-row" aria-label="硬逻辑动作结果">
        <div className="action-result-card">
          <Swords size={16} />
          <span>{message.content}</span>
          <time>{formatTime(message.createdAt)}</time>
        </div>
      </article>
    );
  }

  if (message.kind === 'npc-speech') {
    return (
      <article className="message-row npc" aria-label={`${message.npcSpeech?.name || 'NPC'} 发言`}>
        <div className="npc-avatar" aria-hidden="true">
          <UserRound size={19} />
        </div>

        <div className="message-bubble npc-message-bubble">
          <header className="npc-bubble-header">{message.npcSpeech?.name || 'NPC'}</header>
          <MarkdownContent content={message.content} />
          <footer className="message-meta npc-message-meta">
            <time>{formatTime(message.createdAt)}</time>
          </footer>
        </div>
      </article>
    );
  }

  const isUser = message.role === 'user';

  return (
    <article className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      {!isUser ? (
        <div className="assistant-avatar" aria-hidden="true">
          <Bot size={20} />
        </div>
      ) : null}

      <div className={`message-bubble ${message.status === 'error' ? 'error' : ''}`}>
        {message.content ? (
          isUser ? <p className="message-text">{message.content}</p> : <MarkdownContent content={message.content} />
        ) : (
          <div className="thinking">
            <span />
            <span />
            <span />
            正在思考
          </div>
        )}

        <footer className="message-meta">
          <time>{formatTime(message.createdAt)}</time>
          {isUser ? <CheckCheck size={16} /> : <AssistantActions />}
        </footer>
      </div>
    </article>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a({ children, href, node: _node, ...props }) {
            return (
              <a href={href} rel="noreferrer" target="_blank" {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function AssistantActions() {
  return (
    <span className="assistant-actions" aria-label="助手消息操作">
      <Copy size={16} />
      <ThumbsUp size={16} />
      <ThumbsDown size={16} />
    </span>
  );
}
