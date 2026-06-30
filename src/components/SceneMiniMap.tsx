import { Loader2, Map as MapIcon, Maximize2, Navigation, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { WorldMapScene, WorldMapState } from '../types';

interface SceneMiniMapProps {
  worldMap: WorldMapState | null;
  isLoading: boolean;
  isNavigationDisabled: boolean;
  onEnterScene: (sceneId: string) => void;
}

interface MapNode {
  scene: WorldMapScene;
  x: number;
  y: number;
  distance: number;
  isCurrent: boolean;
  isReachable: boolean;
}

const COMPACT_SIZE = 120;
const FULL_SIZE = 100;

export function SceneMiniMap({
  worldMap,
  isLoading,
  isNavigationDisabled,
  onEnterScene,
}: SceneMiniMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const layout = useMemo(() => buildMapLayout(worldMap), [worldMap]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const selectedNode = layout.nodes.find((node) => node.scene.id === (selectedSceneId || worldMap?.currentSceneId))
    || layout.nodes.find((node) => node.isCurrent)
    || layout.nodes[0]
    || null;

  useEffect(() => {
    if (!isExpanded) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsExpanded(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isExpanded]);

  useEffect(() => {
    setSelectedSceneId(null);
  }, [worldMap?.currentSceneId]);

  function enterSelectedScene() {
    if (!selectedNode || !selectedNode.isReachable || isNavigationDisabled) return;
    setIsExpanded(false);
    onEnterScene(selectedNode.scene.id);
  }

  return (
    <>
      <button
        className="scene-minimap-trigger"
        type="button"
        onClick={() => setIsExpanded(true)}
        aria-label="展开场景地图"
      >
        <span className="scene-minimap-title">
          <MapIcon size={15} />
          <strong>{selectedNode?.isCurrent ? selectedNode.scene.name : layout.currentNode?.scene.name || '地图'}</strong>
          {isLoading ? <Loader2 className="spin" size={13} /> : <Maximize2 size={13} />}
        </span>
        <MiniMapCanvas layout={layout} />
      </button>

      {isExpanded ? (
        <div className="scene-map-modal" role="dialog" aria-modal="true" aria-label="场景地图">
          <button className="scene-map-backdrop" type="button" aria-label="关闭场景地图" onClick={() => setIsExpanded(false)} />
          <section className="scene-map-panel">
            <header className="scene-map-header">
              <div>
                <MapIcon size={18} />
                <strong>场景地图</strong>
              </div>
              <button className="icon-button ghost scene-map-close" type="button" aria-label="关闭场景地图" onClick={() => setIsExpanded(false)}>
                <X size={18} />
              </button>
            </header>

            <div className="scene-map-content">
              <div className="scene-map-board" aria-label="世界场景图">
                <FullMapCanvas
                  layout={layout}
                  selectedSceneId={selectedNode?.scene.id || null}
                  onSelect={setSelectedSceneId}
                />
              </div>

              <aside className="scene-map-detail" aria-label="场景详情">
                {selectedNode ? (
                  <>
                    <div className="scene-map-detail-heading">
                      <strong>{selectedNode.scene.name}</strong>
                      <span>{selectedNode.isCurrent ? '当前位置' : selectedNode.isReachable ? '可前往' : '不可直接前往'}</span>
                    </div>
                    <p>{selectedNode.scene.description || '暂无场景描述。'}</p>
                    {selectedNode.scene.tags.length ? (
                      <div className="scene-map-tags">
                        {selectedNode.scene.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    ) : null}
                    <button
                      className="scene-map-enter"
                      type="button"
                      disabled={!selectedNode.isReachable || isNavigationDisabled}
                      onClick={enterSelectedScene}
                    >
                      <Navigation size={16} />
                      <span>{selectedNode.isCurrent ? '当前位置' : selectedNode.isReachable ? '前往此处' : '需要先到达相邻场景'}</span>
                    </button>
                  </>
                ) : (
                  <p>暂无场景数据。</p>
                )}
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function MiniMapCanvas({ layout }: { layout: ReturnType<typeof buildMapLayout> }) {
  const visibleNodes = layout.nodes
    .filter((node) => node.isCurrent || node.distance <= 1)
    .slice(0, 5);
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
            className={layout.reachableLinkKeys.has(getLinkKey(link.sourceSceneId, link.targetSceneId)) ? 'reachable' : ''}
            key={`${link.sourceSceneId}-${link.targetSceneId}`}
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
  layout: ReturnType<typeof buildMapLayout>;
  selectedSceneId: string | null;
  onSelect: (sceneId: string) => void;
}) {
  return (
    <>
      <svg className="scene-map-links" viewBox={`0 0 ${FULL_SIZE} ${FULL_SIZE}`} aria-hidden="true">
        {layout.links.map((link) => {
        const source = layout.nodeById.get(link.sourceSceneId);
        const target = layout.nodeById.get(link.targetSceneId);
        if (!source || !target) return null;
        return (
          <line
              className={layout.reachableLinkKeys.has(getLinkKey(link.sourceSceneId, link.targetSceneId)) ? 'reachable' : ''}
              key={`${link.sourceSceneId}-${link.targetSceneId}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
            />
          );
        })}
      </svg>
      {layout.nodes.map((node) => (
        <button
          className={[
            'scene-map-node',
            node.isCurrent ? 'current' : '',
            node.isReachable ? 'reachable' : '',
            selectedSceneId === node.scene.id ? 'selected' : '',
          ].filter(Boolean).join(' ')}
          key={node.scene.id}
          type="button"
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          onClick={() => onSelect(node.scene.id)}
        >
          <span>{node.scene.name}</span>
        </button>
      ))}
    </>
  );
}

function buildMapLayout(worldMap: WorldMapState | null) {
  const scenes = [...(worldMap?.scenes || [])].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id, 'zh-Hans-CN'));
  const currentSceneId = worldMap?.currentSceneId || scenes[0]?.id || '';
  const outgoing = new Map<string, Set<string>>();
  const undirected = new Map<string, Set<string>>();

  for (const scene of scenes) {
    outgoing.set(scene.id, new Set());
    undirected.set(scene.id, new Set());
  }
  for (const link of worldMap?.links || []) {
    if (!outgoing.has(link.sourceSceneId) || !outgoing.has(link.targetSceneId)) continue;
    outgoing.get(link.sourceSceneId)?.add(link.targetSceneId);
    undirected.get(link.sourceSceneId)?.add(link.targetSceneId);
    undirected.get(link.targetSceneId)?.add(link.sourceSceneId);
  }

  const directTargets = outgoing.get(currentSceneId) || new Set<string>();
  const distances = getDistances(currentSceneId, undirected);
  const grouped = new Map<number, WorldMapScene[]>();
  const unreachable: WorldMapScene[] = [];
  for (const scene of scenes) {
    if (scene.id === currentSceneId) continue;
    const distance = distances.get(scene.id);
    if (!distance) {
      unreachable.push(scene);
      continue;
    }
    const ring = Math.min(distance, 3);
    grouped.set(ring, [...(grouped.get(ring) || []), scene]);
  }
  if (unreachable.length) grouped.set(4, unreachable);

  const nodes: MapNode[] = [];
  const currentScene = scenes.find((scene) => scene.id === currentSceneId);
  if (currentScene) {
    nodes.push({
      scene: currentScene,
      x: 50,
      y: 50,
      distance: 0,
      isCurrent: true,
      isReachable: false,
    });
  }

  for (const [ring, ringScenes] of [...grouped.entries()].sort(([a], [b]) => a - b)) {
    const radius = ring === 1 ? 24 : ring === 2 ? 34 : ring === 3 ? 42 : 47;
    const startAngle = ring === 1 ? -90 : -90 + ring * 21;
    ringScenes.forEach((scene, index) => {
      const angle = ((startAngle + (360 / ringScenes.length) * index) * Math.PI) / 180;
      nodes.push({
        scene,
        x: clamp(50 + Math.cos(angle) * radius, 8, 92),
        y: clamp(50 + Math.sin(angle) * radius, 10, 90),
        distance: distances.get(scene.id) ?? Number.POSITIVE_INFINITY,
        isCurrent: false,
        isReachable: directTargets.has(scene.id),
      });
    });
  }

  const nodeById = new Map(nodes.map((node) => [node.scene.id, node]));
  const reachableLinkKeys = new Set(
    [...directTargets].map((targetSceneId) => getLinkKey(currentSceneId, targetSceneId)),
  );
  return {
    currentNode: nodes.find((node) => node.isCurrent) || null,
    links: worldMap?.links || [],
    nodeById,
    nodes,
    reachableLinkKeys,
  };
}

function getDistances(startId: string, adjacency: Map<string, Set<string>>) {
  const distances = new Map<string, number>();
  if (!startId || !adjacency.has(startId)) return distances;
  const queue = [startId];
  distances.set(startId, 0);
  for (let index = 0; index < queue.length; index += 1) {
    const sceneId = queue[index];
    const distance = distances.get(sceneId) || 0;
    for (const nextId of adjacency.get(sceneId) || []) {
      if (distances.has(nextId)) continue;
      distances.set(nextId, distance + 1);
      queue.push(nextId);
    }
  }
  return distances;
}

function scaleCompact(value: number) {
  return (value / 100) * COMPACT_SIZE;
}

function getLinkKey(sourceSceneId: string, targetSceneId: string) {
  return `${sourceSceneId}->${targetSceneId}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
