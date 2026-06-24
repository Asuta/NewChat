import { Edit3, FileText, Plus, Search, Settings, UserRound } from 'lucide-react';
import { formatTime } from '../lib/chat';
import type { Conversation } from '../types';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string;
  onNewChat: () => void;
  onSelect: (id: string) => void;
}

export function Sidebar({ conversations, activeId, onNewChat, onSelect }: SidebarProps) {
  return (
    <aside className="sidebar">
      <header className="brand-row">
        <div className="brand-mark">N</div>
        <span>NewChat</span>
        <button className="icon-button ghost" type="button" aria-label="编辑">
          <Edit3 size={18} />
        </button>
      </header>

      <button className="new-chat-button" type="button" onClick={onNewChat}>
        <Plus size={19} />
        新对话
      </button>

      <div className="search-box">
        <Search size={18} />
        <input aria-label="搜索对话" placeholder="搜索对话" />
        <kbd>⌘K</kbd>
      </div>

      <nav className="conversation-list" aria-label="会话列表">
        <p className="date-label">今天</p>
        {conversations.map((conversation) => (
          <button
            className={`conversation-item ${conversation.id === activeId ? 'active' : ''}`}
            key={conversation.id}
            type="button"
            onClick={() => onSelect(conversation.id)}
          >
            <FileText size={17} />
            <span>{conversation.title}</span>
            <time>{formatSidebarTime(conversation.updatedAt)}</time>
          </button>
        ))}
      </nav>

      <footer className="sidebar-footer">
        <button className="settings-row" type="button">
          <Settings size={19} />
          设置
        </button>
        <div className="profile-row">
          <div className="avatar">
            <UserRound size={18} />
          </div>
          <span>user</span>
        </div>
      </footer>
    </aside>
  );
}

function formatSidebarTime(timestamp: number) {
  const age = Date.now() - timestamp;
  if (age > 1000 * 60 * 60 * 24) return '昨天';
  return formatTime(timestamp);
}
