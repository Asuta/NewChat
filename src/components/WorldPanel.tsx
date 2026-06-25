import { Boxes, DoorOpen, GitBranch, MapPinned, RefreshCw, Search, UserRound } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { AgentStep, EntityBundle, WorldEntity, WorldOverview } from '../types';

interface WorldPanelProps {
  world: WorldOverview | null;
  selectedEntity: EntityBundle | null;
  agentSteps: AgentStep[];
  isLoading: boolean;
  onRefresh: () => void;
  onEnterScene: (sceneId: string) => void;
  onSearch: (query: string) => void;
  onSelectEntity: (entityId: string) => void;
}

export function WorldPanel({
  world,
  selectedEntity,
  agentSteps,
  isLoading,
  onRefresh,
  onEnterScene,
  onSearch,
  onSelectEntity,
}: WorldPanelProps) {
  const [query, setQuery] = useState('');
  const scene = world?.currentScene;

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    onSearch(query);
  }

  return (
    <aside className="world-panel" aria-label="游戏世界">
      <div className="world-panel-header">
        <div>
          <strong>游戏世界</strong>
          <span>{world ? `${world.counts.entities} 实体 · ${world.counts.relationships} 关系` : '读取中'}</span>
        </div>
        <button className="icon-button ghost" type="button" aria-label="刷新世界" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={isLoading ? 'spin' : ''} size={18} />
        </button>
      </div>

      <form className="world-search" onSubmit={submitSearch}>
        <button className="world-search-button" type="submit" aria-label="搜索世界">
          <Search size={17} />
        </button>
        <input
          value={query}
          placeholder="搜索实体、别名、描述"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSearch(query);
            }
          }}
        />
      </form>

      <section className="world-section">
        <div className="world-section-title">
          <MapPinned size={16} />
          <span>当前场景</span>
        </div>
        <div className="world-scene-card">
          <strong>{scene?.scene?.name || '未定位'}</strong>
          <p>{scene?.sceneComponent?.description || '暂无场景描述。'}</p>
          <div className="world-tags">
            {(scene?.sceneComponent?.tags || []).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
      </section>

      <WorldEntityList title="人物" icon={<UserRound size={16} />} entities={scene?.residents || []} onSelectEntity={onSelectEntity} />
      <WorldEntityList title="道具" icon={<Boxes size={16} />} entities={scene?.items || []} onSelectEntity={onSelectEntity} />

      <section className="world-section">
        <div className="world-section-title">
          <DoorOpen size={16} />
          <span>出口</span>
        </div>
        <div className="world-list">
          {(scene?.exits || []).length ? (
            scene?.exits.map((exit) => (
              <button className="world-list-row" key={exit.scene.id} type="button" onClick={() => onEnterScene(exit.scene.id)}>
                <strong>{exit.scene.name}</strong>
                <span>{exit.scene.id}</span>
              </button>
            ))
          ) : (
            <p className="world-empty">暂无可前往场景</p>
          )}
        </div>
      </section>

      <section className="world-section entity-detail-section">
        <div className="world-section-title">
          <GitBranch size={16} />
          <span>实体详情</span>
        </div>
        {selectedEntity ? (
          <div className="entity-detail">
            <strong>{selectedEntity.entity.name}</strong>
            <span>{selectedEntity.entity.kind} · {selectedEntity.entity.id}</span>
            {selectedEntity.aliases.length ? <small>别名：{selectedEntity.aliases.join('、')}</small> : null}
            <pre>{JSON.stringify(selectedEntity.components, null, 2)}</pre>
            <small>关系 {selectedEntity.relationships.length} 条</small>
          </div>
        ) : (
          <p className="world-empty">点击人物、道具或搜索结果查看详情</p>
        )}
      </section>

      <section className="world-section">
        <div className="world-section-title">
          <GitBranch size={16} />
          <span>最近 Agent 步骤</span>
        </div>
        <div className="agent-step-list">
          {agentSteps.length ? (
            agentSteps.slice(-5).map((step, index) => (
              <div className="agent-step" key={`${step.tool}-${index}`}>
                <strong>{step.tool}</strong>
                <span>{formatStepResult(step.result)}</span>
              </div>
            ))
          ) : (
            <p className="world-empty">还没有工具调用</p>
          )}
        </div>
      </section>
    </aside>
  );
}

function WorldEntityList({
  title,
  icon,
  entities,
  onSelectEntity,
}: {
  title: string;
  icon: ReactNode;
  entities: WorldEntity[];
  onSelectEntity: (entityId: string) => void;
}) {
  return (
    <section className="world-section">
      <div className="world-section-title">
        {icon}
        <span>{title}</span>
      </div>
      <div className="world-list">
        {entities.length ? (
          entities.map((entity) => (
            <button className="world-list-row" key={entity.id} type="button" onClick={() => onSelectEntity(entity.id)}>
              <strong>{entity.name}</strong>
              <span>{entity.id}</span>
            </button>
          ))
        ) : (
          <p className="world-empty">暂无{title}</p>
        )}
      </div>
    </section>
  );
}

function formatStepResult(result: Record<string, unknown> | undefined) {
  if (!result) return '已执行';
  const summary = result.summary;
  if (typeof summary === 'string' && summary.trim()) return summary;
  const error = result.error;
  if (typeof error === 'string' && error.trim()) return error;
  return '已执行';
}
