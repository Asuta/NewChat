import { Bot, CheckCheck, Copy, ThumbsDown, ThumbsUp } from 'lucide-react';
import { formatTime } from '../lib/chat';
import type { ChatMessage } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
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
          <p>{message.content}</p>
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

function AssistantActions() {
  return (
    <span className="assistant-actions" aria-label="助手消息操作">
      <Copy size={16} />
      <ThumbsUp size={16} />
      <ThumbsDown size={16} />
    </span>
  );
}
