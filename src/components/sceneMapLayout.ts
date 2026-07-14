import type { WorldMapLink, WorldMapScene, WorldMapState } from '../types';

export interface MapNode {
  scene: WorldMapScene;
  x: number;
  y: number;
  distance: number;
  isCurrent: boolean;
  isReachable: boolean;
}

export interface VisualMapLink extends WorldMapLink {
  key: string;
}

export interface MapLayout {
  currentNode: MapNode | null;
  links: VisualMapLink[];
  nodeById: Map<string, MapNode>;
  nodes: MapNode[];
  reachableLinkKeys: Set<string>;
  connectedById: Map<string, Set<string>>;
}

export function buildMapLayout(worldMap: WorldMapState | null): MapLayout {
  const scenes = [...(worldMap?.scenes || [])].sort(compareScenes);
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const currentSceneId = sceneIds.has(worldMap?.currentSceneId || '')
    ? worldMap?.currentSceneId || ''
    : scenes[0]?.id || '';
  const outgoing = new Map<string, Set<string>>();
  const undirected = new Map<string, Set<string>>();

  for (const scene of scenes) {
    outgoing.set(scene.id, new Set());
    undirected.set(scene.id, new Set());
  }

  const visualLinks = new Map<string, VisualMapLink>();
  for (const link of worldMap?.links || []) {
    if (!sceneIds.has(link.sourceSceneId) || !sceneIds.has(link.targetSceneId)) continue;
    if (link.sourceSceneId === link.targetSceneId) continue;
    outgoing.get(link.sourceSceneId)?.add(link.targetSceneId);
    undirected.get(link.sourceSceneId)?.add(link.targetSceneId);
    undirected.get(link.targetSceneId)?.add(link.sourceSceneId);
    const key = getUndirectedLinkKey(link.sourceSceneId, link.targetSceneId);
    if (!visualLinks.has(key)) {
      const [sourceSceneId, targetSceneId] = [link.sourceSceneId, link.targetSceneId].sort(compareIds);
      visualLinks.set(key, { sourceSceneId, targetSceneId, key });
    }
  }

  const directTargets = outgoing.get(currentSceneId) || new Set<string>();
  const distances = getDistances(currentSceneId, outgoing);
  const positions = buildStablePositions(scenes, undirected);
  const nodes = scenes.map((scene) => {
    const position = positions.get(scene.id) || { x: 50, y: 50 };
    return {
      scene,
      ...position,
      distance: distances.get(scene.id) ?? Number.POSITIVE_INFINITY,
      isCurrent: scene.id === currentSceneId,
      isReachable: directTargets.has(scene.id),
    };
  });
  const nodeById = new Map(nodes.map((node) => [node.scene.id, node]));
  const reachableLinkKeys = new Set(
    [...directTargets].map((targetSceneId) => getUndirectedLinkKey(currentSceneId, targetSceneId)),
  );

  return {
    currentNode: nodeById.get(currentSceneId) || null,
    links: [...visualLinks.values()].sort((a, b) => compareIds(a.key, b.key)),
    nodeById,
    nodes,
    reachableLinkKeys,
    connectedById: undirected,
  };
}

function buildStablePositions(scenes: WorldMapScene[], adjacency: Map<string, Set<string>>) {
  const positions = new Map<string, { x: number; y: number }>();
  const components = getConnectedComponents(scenes.map((scene) => scene.id), adjacency)
    .sort((a, b) => b.length - a.length || compareIds(a[0], b[0]));
  if (!components.length) return positions;

  const columns = components.length === 1 ? 1 : Math.ceil(Math.sqrt(components.length * 1.4));
  const rows = Math.ceil(components.length / columns);
  const cellWidth = 86 / columns;
  const cellHeight = 74 / rows;

  components.forEach((component, componentIndex) => {
    const column = componentIndex % columns;
    const row = Math.floor(componentIndex / columns);
    const centerX = 7 + column * cellWidth + cellWidth / 2;
    const centerY = 13 + row * cellHeight + cellHeight / 2;
    const rootId = chooseStructuralRoot(component, adjacency);
    const rootDistances = getDistances(rootId, adjacency);
    const levels = new Map<number, string[]>();

    for (const sceneId of component) {
      const level = rootDistances.get(sceneId) || 0;
      levels.set(level, [...(levels.get(level) || []), sceneId]);
    }

    const componentPositions = new Map<string, { x: number; y: number }>();
    const orderedSceneIds = [rootId];
    componentPositions.set(rootId, { x: centerX, y: centerY });
    const nodeOrder = new Map<string, number>([[rootId, 0]]);
    for (const [level, levelIds] of [...levels.entries()].sort(([a], [b]) => a - b)) {
      if (level === 0) continue;
      levelIds.sort((a, b) => {
        const aParentOrder = getParentOrder(a, level, rootDistances, adjacency, nodeOrder);
        const bParentOrder = getParentOrder(b, level, rootDistances, adjacency, nodeOrder);
        return aParentOrder - bParentOrder || compareIds(a, b);
      });
      levelIds.forEach((sceneId, index) => nodeOrder.set(sceneId, index));
      orderedSceneIds.push(...levelIds);

      const radiusX = Math.min(cellWidth * 0.43, cellWidth * (0.24 + (level - 1) * 0.12));
      const radiusY = Math.min(cellHeight * 0.43, cellHeight * (0.24 + (level - 1) * 0.12));
      const placedPositions = new Map([...positions, ...componentPositions]);
      const angleOffset = chooseRingOffset(levelIds.length, radiusX, radiusY, centerX, centerY, placedPositions);
      levelIds.forEach((sceneId, index) => {
        const angle = ((angleOffset + (360 / levelIds.length) * index) * Math.PI) / 180;
        componentPositions.set(sceneId, {
          x: clamp(centerX + Math.cos(angle) * radiusX, 11, 89),
          y: clamp(centerY + Math.sin(angle) * radiusY, 10, 90),
        });
      });
    }

    const finalComponentPositions = hasVisualOverlap(componentPositions)
      ? buildGridFallbackPositions(orderedSceneIds, centerX, centerY, cellWidth, cellHeight)
      : componentPositions;
    for (const [sceneId, position] of finalComponentPositions) positions.set(sceneId, position);
  });

  return positions;
}

function chooseRingOffset(
  nodeCount: number,
  radiusX: number,
  radiusY: number,
  centerX: number,
  centerY: number,
  placedPositions: Map<string, { x: number; y: number }>,
) {
  const baseOffset = -90;
  const candidateCount = Math.max(12, Math.min(32, nodeCount * 6));
  let bestOffset = baseOffset;
  let bestSeparation = Number.NEGATIVE_INFINITY;

  for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
    const offset = baseOffset + (360 / candidateCount) * candidateIndex;
    const candidatePositions = Array.from({ length: nodeCount }, (_, nodeIndex) => {
      const angle = ((offset + (360 / nodeCount) * nodeIndex) * Math.PI) / 180;
      return {
        x: clamp(centerX + Math.cos(angle) * radiusX, 11, 89),
        y: clamp(centerY + Math.sin(angle) * radiusY, 10, 90),
      };
    });
    const separation = getMinimumVisualSeparation(candidatePositions, [...placedPositions.values()]);
    if (separation > bestSeparation) {
      bestSeparation = separation;
      bestOffset = offset;
    }
  }

  return bestOffset;
}

function getMinimumVisualSeparation(
  candidates: Array<{ x: number; y: number }>,
  placed: Array<{ x: number; y: number }>,
) {
  let minimum = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    for (const existing of placed) {
      const normalizedX = (candidate.x - existing.x) / 15;
      const normalizedY = (candidate.y - existing.y) / 8.5;
      minimum = Math.min(minimum, Math.hypot(normalizedX, normalizedY));
    }
  }
  return minimum;
}

function hasVisualOverlap(positions: Map<string, { x: number; y: number }>) {
  const values = [...positions.values()];
  for (let firstIndex = 0; firstIndex < values.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < values.length; secondIndex += 1) {
      const first = values[firstIndex];
      const second = values[secondIndex];
      if (Math.abs(first.x - second.x) < 15 && Math.abs(first.y - second.y) < 8.5) return true;
    }
  }
  return false;
}

function buildGridFallbackPositions(
  orderedSceneIds: string[],
  centerX: number,
  centerY: number,
  cellWidth: number,
  cellHeight: number,
) {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeCount = orderedSceneIds.length;
  const maximumColumns = Math.max(1, Math.floor((cellWidth - 2) / 15));
  const maximumRows = Math.max(1, Math.floor((cellHeight - 2) / 8.5));
  let columns = clampInteger(
    Math.ceil(Math.sqrt(nodeCount * (cellWidth / cellHeight) * (8.5 / 15))),
    1,
    maximumColumns,
  );
  while (Math.ceil(nodeCount / columns) > maximumRows && columns < maximumColumns) columns += 1;
  const rows = Math.max(1, Math.ceil(nodeCount / columns));
  const horizontalInset = Math.min(7.5, cellWidth * 0.12);
  const verticalInset = Math.min(4.25, cellHeight * 0.1);
  const left = centerX - cellWidth / 2 + horizontalInset;
  const top = centerY - cellHeight / 2 + verticalInset;
  const usableWidth = Math.max(0, cellWidth - horizontalInset * 2);
  const usableHeight = Math.max(0, cellHeight - verticalInset * 2);
  const slots = getSpiralGridSlots(columns, rows).map(({ column, row }) => ({
    x: columns === 1 ? centerX : left + (usableWidth * column) / (columns - 1),
    y: rows === 1 ? centerY : top + (usableHeight * row) / (rows - 1),
  }));

  orderedSceneIds.forEach((sceneId, index) => {
    const slot = slots[index] || { x: centerX, y: centerY };
    positions.set(sceneId, { x: clamp(slot.x, 11, 89), y: clamp(slot.y, 10, 90) });
  });
  return positions;
}

function getSpiralGridSlots(columns: number, rows: number) {
  const slots: Array<{ column: number; row: number }> = [];
  const visited = new Set<string>();
  let column = Math.floor((columns - 1) / 2);
  let row = Math.floor((rows - 1) / 2);
  let directionIndex = 0;
  let segmentLength = 1;
  const directions = [
    { column: 1, row: 0 },
    { column: 0, row: 1 },
    { column: -1, row: 0 },
    { column: 0, row: -1 },
  ];

  const addSlot = () => {
    if (column < 0 || column >= columns || row < 0 || row >= rows) return;
    const key = `${column}:${row}`;
    if (visited.has(key)) return;
    visited.add(key);
    slots.push({ column, row });
  };
  addSlot();

  while (slots.length < columns * rows) {
    for (let segment = 0; segment < 2; segment += 1) {
      const direction = directions[directionIndex % directions.length];
      for (let step = 0; step < segmentLength; step += 1) {
        column += direction.column;
        row += direction.row;
        addSlot();
      }
      directionIndex += 1;
    }
    segmentLength += 1;
  }
  return slots;
}

function getConnectedComponents(sceneIds: string[], adjacency: Map<string, Set<string>>) {
  const components: string[][] = [];
  const visited = new Set<string>();
  for (const startId of [...sceneIds].sort(compareIds)) {
    if (visited.has(startId)) continue;
    const component: string[] = [];
    const queue = [startId];
    visited.add(startId);
    for (let index = 0; index < queue.length; index += 1) {
      const sceneId = queue[index];
      component.push(sceneId);
      for (const nextId of [...(adjacency.get(sceneId) || [])].sort(compareIds)) {
        if (visited.has(nextId)) continue;
        visited.add(nextId);
        queue.push(nextId);
      }
    }
    components.push(component.sort(compareIds));
  }
  return components;
}

function chooseStructuralRoot(component: string[], adjacency: Map<string, Set<string>>) {
  return [...component].sort((a, b) => {
    const degreeDifference = (adjacency.get(b)?.size || 0) - (adjacency.get(a)?.size || 0);
    return degreeDifference || compareIds(a, b);
  })[0];
}

function getParentOrder(
  sceneId: string,
  level: number,
  distances: Map<string, number>,
  adjacency: Map<string, Set<string>>,
  nodeOrder: Map<string, number>,
) {
  const parentOrders = [...(adjacency.get(sceneId) || [])]
    .filter((candidateId) => distances.get(candidateId) === level - 1)
    .map((candidateId) => nodeOrder.get(candidateId) ?? Number.MAX_SAFE_INTEGER);
  return parentOrders.length ? Math.min(...parentOrders) : Number.MAX_SAFE_INTEGER;
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

export function compareScenes(a: WorldMapScene, b: WorldMapScene) {
  return (a.name || a.id).localeCompare(b.name || b.id, 'zh-Hans-CN') || compareIds(a.id, b.id);
}

function compareIds(a: string, b: string) {
  return a.localeCompare(b, 'en');
}

function getUndirectedLinkKey(sourceSceneId: string, targetSceneId: string) {
  return [sourceSceneId, targetSceneId].sort(compareIds).join('::');
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampInteger(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}
