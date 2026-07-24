import {
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  ListChecks,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { QuestLog, QuestLogItem } from '../types';

interface QuestTrackerProps {
  quests?: QuestLog | null;
}

const MAX_VISIBLE_QUESTS = 4;

export function QuestTracker({ quests }: QuestTrackerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const items = quests?.items || [];
  const activeQuests = items.filter((quest) => quest.status === 'active');
  if (!items.length) return null;

  const visibleQuests = isExpanded
    ? items
    : activeQuests.slice(0, MAX_VISIBLE_QUESTS);
  const hiddenCount = Math.max(0, activeQuests.length - MAX_VISIBLE_QUESTS);
  const hasQuestHistory = items.length > activeQuests.length;

  return (
    <aside
      className={`stage-quest-tracker${isExpanded ? ' is-expanded' : ''}`}
      aria-label={`当前任务，共 ${activeQuests.length} 项`}
    >
      <button
        className="stage-quest-tracker-header"
        type="button"
        aria-controls="stage-quest-tracker-list"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? '收起任务日志' : '展开任务日志'}
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        <ListChecks size={15} />
        <strong>{isExpanded ? '任务日志' : '当前任务'}</strong>
        <span>{isExpanded ? `${activeQuests.length} 进行中` : activeQuests.length}</span>
        <ChevronDown className="stage-quest-tracker-chevron" size={13} />
      </button>
      <ol className="stage-quest-tracker-list" id="stage-quest-tracker-list">
        {visibleQuests.map((quest) => {
          const summary = quest.progressSummary || quest.description || '等待新的剧情进展。';
          return (
            <li
              className={`stage-quest-tracker-item is-${quest.status}`}
              key={quest.id}
              title={summary}
            >
              <QuestStatusIcon quest={quest} />
              <div>
                <div className="stage-quest-tracker-title">
                  <strong>{quest.title}</strong>
                  {isExpanded ? <small>{getQuestStatusLabel(quest.status)}</small> : null}
                </div>
                <p>{summary}</p>
                {isExpanded && quest.status === 'active' && quest.completionCriteria ? (
                  <span className="stage-quest-tracker-criteria" title={quest.completionCriteria}>
                    目标：{quest.completionCriteria}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {!visibleQuests.length ? (
        <span className="stage-quest-tracker-empty">当前没有进行中的任务</span>
      ) : null}
      {isExpanded || hiddenCount > 0 || hasQuestHistory ? (
        <button
          className="stage-quest-tracker-more"
          type="button"
          aria-expanded={isExpanded}
          aria-controls="stage-quest-tracker-list"
          onClick={() => setIsExpanded((expanded) => !expanded)}
        >
          {isExpanded
            ? '收起任务日志'
            : hiddenCount > 0
              ? `还有 ${hiddenCount} 项进行中 · 查看全部`
              : '查看全部任务'}
        </button>
      ) : null}
    </aside>
  );
}

function QuestStatusIcon({ quest }: { quest: QuestLogItem }) {
  if (quest.status === 'completed') return <CheckCircle2 size={11} aria-hidden="true" />;
  if (quest.status === 'failed') return <XCircle size={11} aria-hidden="true" />;
  if (quest.status === 'inactive') return <Circle size={11} aria-hidden="true" />;
  return <CircleDot size={11} aria-hidden="true" />;
}

function getQuestStatusLabel(status: QuestLogItem['status']) {
  if (status === 'completed') return '已完成';
  if (status === 'failed') return '已失败';
  if (status === 'inactive') return '未开始';
  return '进行中';
}
