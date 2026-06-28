import { Bot, CheckCheck, Copy, MapPinned, Swords, ThumbsDown, ThumbsUp, UserRound } from 'lucide-react';
import { formatTime } from '../lib/chat';
import type { ChatMessage } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
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
          <p>{message.content}</p>
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
