import { CheckCircle2, CircleDot, ListChecks, XCircle } from 'lucide-react';
import type { QuestLog, QuestLogItem } from '../types';

interface QuestPanelProps {
  quests?: QuestLog | null;
}

export function QuestPanel({ quests }: QuestPanelProps) {
  const items = quests?.items || [];
  if (!items.length) {
    return (
      <div className="quest-panel-empty">
        <ListChecks size={18} />
        <span>当前没有已公开的任务</span>
      </div>
    );
  }

  return (
    <div className="quest-panel">
      <div className="quest-panel-summary">
        <span><CircleDot size={12} />进行中 {quests?.activeCount || 0}</span>
        <span><CheckCircle2 size={12} />已完成 {quests?.completedCount || 0}</span>
      </div>
      <div className="quest-card-list">
        {items.map((quest) => (
          <article className={`quest-card is-${quest.status}`} key={quest.id}>
            <header>
              <QuestStatusIcon quest={quest} />
              <strong>{quest.title}</strong>
              <small>{getQuestStatusLabel(quest.status)}</small>
            </header>
            <p>{quest.progressSummary || quest.description || '尚无进度记录。'}</p>
            {quest.status === 'active' && quest.completionCriteria ? (
              <span title={quest.completionCriteria}>目标：{quest.completionCriteria}</span>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function QuestStatusIcon({ quest }: { quest: QuestLogItem }) {
  if (quest.status === 'completed') return <CheckCircle2 size={15} />;
  if (quest.status === 'failed') return <XCircle size={15} />;
  return <CircleDot size={15} />;
}

function getQuestStatusLabel(status: QuestLogItem['status']) {
  if (status === 'completed') return '已完成';
  if (status === 'failed') return '已失败';
  if (status === 'inactive') return '未开始';
  return '进行中';
}

