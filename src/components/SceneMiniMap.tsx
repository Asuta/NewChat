import {
  Archive,
  BookOpen,
  Church,
  Circle,
  CircleDot,
  Crown,
  DoorOpen,
  Drama,
  Footprints,
  Landmark,
  Loader2,
  Map as MapIcon,
  Maximize2,
  Navigation,
  Route,
  Shield,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { WorldMapScene, WorldMapState } from '../types';
import { buildMapLayout, compareScenes, type MapLayout, type MapNode } from './sceneMapLayout';

interface SceneMiniMapProps {
  worldMap: WorldMapState | null;
  isLoading: boolean;
  isNavigationDisabled: boolean;
  isInteractive?: boolean;
  onEnterScene: (sceneId: string) => void;
}

const COMPACT_SIZE = 120;
const FULL_SIZE = 100;

export function SceneMiniMap({
  worldMap,
  isLoading,
  isNavigationDisabled,
  isInteractive = true,
  onEnterScene,
}: SceneMiniMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const layout = useMemo(() => buildMapLayout(worldMap), [worldMap]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const selectedNode = layout.nodes.find((node) => node.scene.id === (selectedSceneId || worldMap?.currentSceneId))
    || layout.currentNode
    || layout.nodes[0]
    || null;

  const closeMap = useCallback(() => setIsExpanded(false), []);

  useEffect(() => {
    if (!isExpanded) return undefined;
    const panel = panelRef.current;
    const focusTarget = panel?.querySelector<HTMLElement>('.scene-map-node.current')
      || panel?.querySelector<HTMLElement>('.scene-map-node')
      || panel?.querySelector<HTMLElement>('.scene-map-close');
    const focusFrame = window.requestAnimationFrame(() => focusTarget?.focus());

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMap();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hasAttribute('hidden'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleDialogKeyDown);
      triggerRef.current?.focus();
    };
  }, [closeMap, isExpanded]);

  useEffect(() => {
    setSelectedSceneId(null);
  }, [worldMap?.currentSceneId]);

  function openMap() {
    setSelectedSceneId(null);
    setIsExpanded(true);
  }

  function enterSelectedScene() {
    if (!selectedNode || !selectedNode.isReachable || isNavigationDisabled) return;
    closeMap();
    onEnterScene(selectedNode.scene.id);
  }

  const title = layout.currentNode?.scene.name || '地图';
  const triggerContent = (
    <>
      <span className="scene-minimap-title">
        <MapIcon size={15} />
        <strong>{title}</strong>
        {isLoading ? <Loader2 className="spin" size={13} /> : isInteractive ? <Maximize2 size={13} /> : null}
      </span>
      <MiniMapCanvas layout={layout} />
    </>
  );

  return (
    <>
      {!isInteractive ? (
        <div className="scene-minimap-trigger readonly" aria-label="场景地图预览">
          {triggerContent}
        </div>
      ) : (
        <button
          ref={triggerRef}
          className="scene-minimap-trigger"
          type="button"
          onClick={openMap}
          aria-label="展开场景地图"
        >
          {triggerContent}
        </button>
      )}

      {isExpanded ? (
        <div className="scene-map-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button
            className="scene-map-backdrop"
            type="button"
            tabIndex={-1}
            aria-label="关闭场景地图"
            onClick={closeMap}
          />
          <section ref={panelRef} className="scene-map-panel">
            <header className="scene-map-header">
              <div className="scene-map-header-title">
                <span className="scene-map-header-icon"><MapIcon size={18} /></span>
                <span>
                  <strong id={titleId}>场景地图</strong>
                  <small>已发现 {layout.nodes.length} 个地点</small>
                </span>
              </div>
              <div className="scene-map-header-actions">
                <div className="scene-map-legend" aria-label="地图图例">
                  <span><Circle className="current" size={8} fill="currentColor" />当前位置</span>
                  <span><Circle className="reachable" size={8} fill="currentColor" />可前往</span>
                  <span><Circle className="known" size={8} fill="currentColor" />已发现</span>
                </div>
                <button className="icon-button ghost scene-map-close" type="button" aria-label="关闭场景地图" onClick={closeMap}>
                  <X size={18} />
                </button>
              </div>
            </header>

            <div className="scene-map-content">
              <div className="scene-map-board" aria-label="世界场景图">
                <FullMapCanvas
                  layout={layout}
                  selectedSceneId={selectedNode?.scene.id || null}
                  onSelect={setSelectedSceneId}
                />
              </div>

              <SceneMapDetail
                layout={layout}
                node={selectedNode}
                isNavigationDisabled={isNavigationDisabled}
                onEnter={enterSelectedScene}
              />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function MiniMapCanvas({ layout }: { layout: MapLayout }) {
  const visibleNodes = [...layout.nodes]
    .filter((node) => node.isCurrent || node.distance <= 1)
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || compareScenes(a.scene, b.scene))
    .slice(0, 6);
  const visibleIds = new Set(visibleNodes.map((node) => node.scene.id));
  const visibleLinks = layout.links.filter((link) => visibleIds.has(link.sourceSceneId) && visibleIds.has(link.targetSceneId));

  return (
    <svg className="scene-minimap-svg" viewBox={`0 0 ${COMPACT_SIZE} ${COMPACT_SIZE}`} aria-hidden="true">
      {visibleLinks.map((link) => {
        const source = layout.nodeById.get(link.sourceSceneId);
        const target = layout.nodeById.get(link.targetSceneId);
        if (!source || !target) return null;
        return (
          <line
            className={layout.reachableLinkKeys.has(link.key) ? 'reachable' : ''}
            key={link.key}
            x1={scaleCompact(source.x)}
            y1={scaleCompact(source.y)}
            x2={scaleCompact(target.x)}
            y2={scaleCompact(target.y)}
          />
        );
      })}
      {visibleNodes.map((node) => (
        <circle
          className={node.isCurrent ? 'current' : node.isReachable ? 'reachable' : ''}
          key={node.scene.id}
          cx={scaleCompact(node.x)}
          cy={scaleCompact(node.y)}
          r={node.isCurrent ? 6 : 4}
        />
      ))}
    </svg>
  );
}

function FullMapCanvas({
  layout,
  selectedSceneId,
  onSelect,
}: {
  layout: MapLayout;
  selectedSceneId: string | null;
  onSelect: (sceneId: string) => void;
}) {
  const selectedConnections = selectedSceneId
    ? layout.connectedById.get(selectedSceneId) || new Set<string>()
    : new Set<string>();

  function handleNodeKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, node: MapNode) {
    const direction = getArrowDirection(event.key);
    let target: MapNode | null = null;
    if (direction) target = findDirectionalNode(node, layout.nodes, direction);
    if (event.key === 'Home') target = layout.currentNode;
    if (!target) return;
    event.preventDefault();
    onSelect(target.scene.id);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('.scene-map-node');
    [...(buttons || [])].find((button) => button.dataset.sceneId === target?.scene.id)?.focus();
  }

  if (!layout.nodes.length) {
    return <div className="scene-map-empty"><MapIcon size={24} /><span>暂无场景数据</span></div>;
  }

  return (
    <>
      <svg className="scene-map-links" viewBox={`0 0 ${FULL_SIZE} ${FULL_SIZE}`} preserveAspectRatio="none" aria-hidden="true">
        {layout.links.map((link) => {
          const source = layout.nodeById.get(link.sourceSceneId);
          const target = layout.nodeById.get(link.targetSceneId);
          if (!source || !target) return null;
          const isSelectedRoute = Boolean(selectedSceneId)
            && (link.sourceSceneId === selectedSceneId || link.targetSceneId === selectedSceneId);
          return (
            <line
              className={[
                layout.reachableLinkKeys.has(link.key) ? 'reachable' : '',
                isSelectedRoute ? 'selected-route' : selectedSceneId ? 'muted-route' : '',
              ].filter(Boolean).join(' ')}
              key={link.key}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      {layout.nodes.map((node) => {
        const SceneIcon = getSceneIcon(node.scene);
        const isSelected = selectedSceneId === node.scene.id;
        const isContextNode = isSelected || selectedConnections.has(node.scene.id);
        return (
          <button
            className={[
              'scene-map-node',
              node.isCurrent ? 'current' : '',
              node.isReachable ? 'reachable' : '',
              isSelected ? 'selected' : '',
              selectedSceneId && !isContextNode ? 'context-dimmed' : '',
            ].filter(Boolean).join(' ')}
            key={node.scene.id}
            type="button"
            data-scene-id={node.scene.id}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            aria-pressed={isSelected}
            aria-label={`${node.scene.name}，${getNodeStatus(node)}`}
            onClick={() => onSelect(node.scene.id)}
            onKeyDown={(event) => handleNodeKeyDown(event, node)}
          >
            <span className="scene-map-node-icon"><SceneIcon size={14} /></span>
            <span className="scene-map-node-name">{node.scene.name}</span>
            {node.isCurrent ? <span className="scene-map-node-marker">在此</span> : null}
          </button>
        );
      })}
    </>
  );
}

function SceneMapDetail({
  layout,
  node,
  isNavigationDisabled,
  onEnter,
}: {
  layout: MapLayout;
  node: MapNode | null;
  isNavigationDisabled: boolean;
  onEnter: () => void;
}) {
  if (!node) {
    return (
      <aside className="scene-map-detail" aria-label="场景详情">
        <p>暂无场景数据。</p>
      </aside>
    );
  }

  const SceneIcon = getSceneIcon(node.scene);
  const connectionCount = layout.connectedById.get(node.scene.id)?.size || 0;
  const distanceLabel = getDistanceLabel(node);

  return (
    <aside className="scene-map-detail" aria-label="场景详情">
      <div className={`scene-map-detail-status ${node.isCurrent ? 'current' : node.isReachable ? 'reachable' : ''}`}>
        <SceneIcon size={15} />
        <span>{getNodeStatus(node)}</span>
      </div>
      <div className="scene-map-detail-heading">
        <strong>{node.scene.name}</strong>
        <small>{distanceLabel}</small>
      </div>
      <p className="scene-map-description">{node.scene.description || '暂无场景描述。'}</p>
      {node.scene.tags.length ? (
        <div className="scene-map-tags" aria-label="场景标签">
          {node.scene.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      ) : null}
      <div className="scene-map-detail-meta">
        <span><Route size={15} />连接 {connectionCount} 处地点</span>
        <span><Footprints size={15} />{distanceLabel}</span>
      </div>
      <div className="scene-map-detail-action">
        {node.isCurrent ? (
          <div className="scene-map-location-note current"><Navigation size={16} /><span>你在这里</span></div>
        ) : node.isReachable ? (
          <button className="scene-map-enter" type="button" disabled={isNavigationDisabled} onClick={onEnter}>
            <Navigation size={16} />
            <span>{isNavigationDisabled ? '当前无法移动' : '前往此处'}</span>
          </button>
        ) : (
          <div className="scene-map-location-note"><Route size={16} /><span>需要先到达相邻场景</span></div>
        )}
      </div>
    </aside>
  );
}

function findDirectionalNode(
  source: MapNode,
  nodes: MapNode[],
  direction: { x: number; y: number },
) {
  return nodes
    .filter((node) => {
      if (node.scene.id === source.scene.id) return false;
      const dx = node.x - source.x;
      const dy = node.y - source.y;
      return dx * direction.x + dy * direction.y > 2;
    })
    .sort((a, b) => getDirectionalScore(source, a, direction) - getDirectionalScore(source, b, direction))[0] || null;
}

function getDirectionalScore(source: MapNode, target: MapNode, direction: { x: number; y: number }) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const forward = Math.abs(dx * direction.x + dy * direction.y);
  const sideways = Math.abs(dx * direction.y - dy * direction.x);
  return forward + sideways * 2.4;
}

function getArrowDirection(key: string) {
  if (key === 'ArrowLeft') return { x: -1, y: 0 };
  if (key === 'ArrowRight') return { x: 1, y: 0 };
  if (key === 'ArrowUp') return { x: 0, y: -1 };
  if (key === 'ArrowDown') return { x: 0, y: 1 };
  return null;
}

function getSceneIcon(scene: WorldMapScene): LucideIcon {
  const keywords = `${scene.name} ${scene.tags.join(' ')}`.toLowerCase();
  if (/骑士|shield|试炼/.test(keywords)) return Shield;
  if (/王冠|王座|crown/.test(keywords)) return Crown;
  if (/教会|礼拜|祷|chapel|church/.test(keywords)) return Church;
  if (/剧场|议会|theater/.test(keywords)) return Drama;
  if (/登记|档案|archive|registry/.test(keywords)) return Archive;
  if (/陵墓|圣库|遗迹|tomb|sanctum/.test(keywords)) return Landmark;
  if (/门|gate|出口/.test(keywords)) return DoorOpen;
  if (/记忆|梦|镜|memory|dream/.test(keywords)) return Sparkles;
  if (/书|知识|禁书|book/.test(keywords)) return BookOpen;
  return CircleDot;
}

function getNodeStatus(node: MapNode) {
  if (node.isCurrent) return '当前位置';
  if (node.isReachable) return '可前往';
  return '已发现';
}

function getDistanceLabel(node: MapNode) {
  if (node.isCurrent) return '当前位置';
  if (node.distance === 1) return '相邻地点';
  if (Number.isFinite(node.distance)) return `距离 ${node.distance} 步`;
  return '尚未连通';
}

function scaleCompact(value: number) {
  return (value / 100) * COMPACT_SIZE;
}
