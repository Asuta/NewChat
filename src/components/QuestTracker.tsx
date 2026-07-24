import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDot,
  ListChecks,
  XCircle,
} from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { QuestLog, QuestLogItem } from '../types';

interface QuestTrackerProps {
  quests?: QuestLog | null;
}

const MAX_VISIBLE_QUESTS = 4;

export function QuestTracker({ quests }: QuestTrackerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const questListRef = useRef<HTMLOListElement | null>(null);
  const selectedQuestRef = useRef<HTMLLIElement | null>(null);
  const items = quests?.items || [];
  const activeQuests = items.filter((quest) => quest.status === 'active');
  const visibleQuests = isExpanded
    ? items
    : activeQuests.slice(0, MAX_VISIBLE_QUESTS);
  const hiddenCount = Math.max(0, activeQuests.length - MAX_VISIBLE_QUESTS);
  const hasQuestHistory = items.length > activeQuests.length;

  useLayoutEffect(() => {
    const list = questListRef.current;
    const selectedQuest = selectedQuestRef.current;
    if (!isExpanded || !selectedQuestId || !list || !selectedQuest) return;

    const listBounds = list.getBoundingClientRect();
    const questBounds = selectedQuest.getBoundingClientRect();
    if (questBounds.height > listBounds.height || questBounds.top < listBounds.top) {
      list.scrollTop += questBounds.top - listBounds.top;
      return;
    }
    if (questBounds.bottom > listBounds.bottom) {
      list.scrollTop += questBounds.bottom - listBounds.bottom;
    }
  }, [isExpanded, selectedQuestId]);

  if (!items.length) return null;

  function toggleQuestLog() {
    if (isExpanded) setSelectedQuestId(null);
    setIsExpanded((expanded) => !expanded);
  }

  function toggleQuestDetails(questId: string) {
    if (!isExpanded) {
      setIsExpanded(true);
      setSelectedQuestId(questId);
      return;
    }
    setSelectedQuestId((currentQuestId) => (
      currentQuestId === questId ? null : questId
    ));
  }

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
        onClick={toggleQuestLog}
      >
        <ListChecks size={15} />
        <strong>{isExpanded ? '任务日志' : '当前任务'}</strong>
        <span>{isExpanded ? `${activeQuests.length} 进行中` : activeQuests.length}</span>
        <ChevronDown className="stage-quest-tracker-chevron" size={13} />
      </button>
      <ol
        className="stage-quest-tracker-list"
        id="stage-quest-tracker-list"
        ref={questListRef}
      >
        {visibleQuests.map((quest) => {
          const summary = quest.progressSummary || quest.description || '等待新的剧情进展。';
          const isSelected = isExpanded && selectedQuestId === quest.id;
          const detailId = `stage-quest-detail-${quest.id}`;
          return (
            <li
              className={[
                'stage-quest-tracker-item',
                `is-${quest.status}`,
                isSelected ? 'has-open-detail' : '',
              ].filter(Boolean).join(' ')}
              key={quest.id}
              ref={isSelected ? selectedQuestRef : undefined}
            >
              <button
                className="stage-quest-tracker-item-button"
                type="button"
                aria-controls={detailId}
                aria-expanded={isSelected}
                aria-label={`查看任务“${quest.title}”详情`}
                title={summary}
                onClick={() => toggleQuestDetails(quest.id)}
              >
                <QuestStatusIcon quest={quest} />
                <div>
                  <div className="stage-quest-tracker-title">
                    <strong>{quest.title}</strong>
                    {isExpanded ? <small>{getQuestStatusLabel(quest.status)}</small> : null}
                  </div>
                  <p>{summary}</p>
                </div>
                <ChevronRight className="stage-quest-tracker-item-chevron" size={12} aria-hidden="true" />
              </button>
              <QuestDetails quest={quest} detailId={detailId} isVisible={isSelected} />
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
          onClick={toggleQuestLog}
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

function QuestDetails({
  quest,
  detailId,
  isVisible,
}: {
  quest: QuestLogItem;
  detailId: string;
  isVisible: boolean;
}) {
  return (
    <div
      className="stage-quest-tracker-detail"
      id={detailId}
      role="region"
      aria-label={`${quest.title}任务详情`}
      hidden={!isVisible}
    >
      <dl>
        {quest.description ? (
          <div>
            <dt>任务说明</dt>
            <dd>{quest.description}</dd>
          </div>
        ) : null}
        <div>
          <dt>当前进度</dt>
          <dd>{quest.progressSummary || '尚无进度记录。'}</dd>
        </div>
        {quest.completionCriteria ? (
          <div className="is-objective">
            <dt>达成条件</dt>
            <dd>{quest.completionCriteria}</dd>
          </div>
        ) : null}
      </dl>
    </div>
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
