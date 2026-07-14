import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMapLayout } from './sceneMapLayout.ts';

const scenes = [
  { id: 'hub', name: '枢纽', description: '', tags: ['枢纽'] },
  { id: 'north', name: '北区', description: '', tags: [] },
  { id: 'east', name: '东区', description: '', tags: [] },
  { id: 'south', name: '南区', description: '', tags: [] },
];

const reciprocalLinks = [
  { sourceSceneId: 'hub', targetSceneId: 'north' },
  { sourceSceneId: 'north', targetSceneId: 'hub' },
  { sourceSceneId: 'hub', targetSceneId: 'east' },
  { sourceSceneId: 'east', targetSceneId: 'hub' },
  { sourceSceneId: 'hub', targetSceneId: 'south' },
  { sourceSceneId: 'south', targetSceneId: 'hub' },
];

function createMap(currentSceneId) {
  return { currentSceneId, scenes, links: reciprocalLinks };
}

test('scene map renders reciprocal exits as one visual route', () => {
  const layout = buildMapLayout(createMap('north'));

  assert.equal(layout.links.length, 3);
  assert.deepEqual(
    layout.links.map((link) => link.key),
    ['east::hub', 'hub::north', 'hub::south'],
  );
});

test('scene positions stay stable when the current scene changes', () => {
  const fromNorth = buildMapLayout(createMap('north'));
  const fromSouth = buildMapLayout(createMap('south'));

  for (const scene of scenes) {
    const first = fromNorth.nodeById.get(scene.id);
    const second = fromSouth.nodeById.get(scene.id);
    assert.deepEqual(
      { x: first?.x, y: first?.y },
      { x: second?.x, y: second?.y },
      `${scene.id} should not move with the player`,
    );
  }
  assert.deepEqual(
    { x: fromNorth.nodeById.get('hub')?.x, y: fromNorth.nodeById.get('hub')?.y },
    { x: 50, y: 50 },
  );
});

test('navigation reachability remains directed after visual route deduplication', () => {
  const layout = buildMapLayout({
    currentSceneId: 'north',
    scenes: scenes.slice(0, 2),
    links: [{ sourceSceneId: 'hub', targetSceneId: 'north' }],
  });

  assert.equal(layout.links.length, 1);
  assert.equal(layout.nodeById.get('hub')?.isReachable, false);
  assert.equal(layout.nodeById.get('hub')?.distance, Number.POSITIVE_INFINITY);
  assert.equal(layout.nodeById.get('north')?.isCurrent, true);
});

test('dense hub maps fall back to a collision-free stable grid', () => {
  const leafIds = Array.from({ length: 24 }, (_, index) => `leaf-${String(index).padStart(2, '0')}`);
  const worldMap = {
    currentSceneId: 'hub',
    scenes: [
      { id: 'hub', name: '枢纽', description: '', tags: [] },
      ...leafIds.map((id) => ({ id, name: id, description: '', tags: [] })),
    ],
    links: leafIds.map((id) => ({ sourceSceneId: 'hub', targetSceneId: id })),
  };
  const first = buildMapLayout(worldMap);
  const second = buildMapLayout(worldMap);

  assertNoVisualOverlap(first.nodes);
  assert.deepEqual(
    first.nodes.map((node) => [node.scene.id, node.x, node.y]),
    second.nodes.map((node) => [node.scene.id, node.x, node.y]),
  );
});

test('deep chain maps never reuse a node position', () => {
  const sceneIds = Array.from({ length: 18 }, (_, index) => `node-${String(index).padStart(2, '0')}`);
  const layout = buildMapLayout({
    currentSceneId: sceneIds[0],
    scenes: sceneIds.map((id) => ({ id, name: id, description: '', tags: [] })),
    links: sceneIds.slice(1).map((id, index) => ({ sourceSceneId: sceneIds[index], targetSceneId: id })),
  });

  assertNoVisualOverlap(layout.nodes);
  assert.equal(new Set(layout.nodes.map((node) => `${node.x}:${node.y}`)).size, sceneIds.length);
});

test('disconnected scene groups receive deterministic in-bounds positions', () => {
  const worldMap = {
    currentSceneId: 'a',
    scenes: ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, description: '', tags: [] })),
    links: [
      { sourceSceneId: 'a', targetSceneId: 'b' },
      { sourceSceneId: 'c', targetSceneId: 'd' },
    ],
  };
  const first = buildMapLayout(worldMap);
  const second = buildMapLayout(worldMap);

  assert.equal(first.nodes.length, 4);
  for (const node of first.nodes) {
    assert.ok(node.x >= 7 && node.x <= 93);
    assert.ok(node.y >= 10 && node.y <= 90);
    assert.deepEqual(
      { x: node.x, y: node.y },
      { x: second.nodeById.get(node.scene.id)?.x, y: second.nodeById.get(node.scene.id)?.y },
    );
  }
  assert.notDeepEqual(
    { x: first.nodeById.get('a')?.x, y: first.nodeById.get('a')?.y },
    { x: first.nodeById.get('c')?.x, y: first.nodeById.get('c')?.y },
  );
});

function assertNoVisualOverlap(nodes) {
  for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
      const first = nodes[firstIndex];
      const second = nodes[secondIndex];
      const overlaps = Math.abs(first.x - second.x) < 15 && Math.abs(first.y - second.y) < 8.5;
      assert.equal(overlaps, false, `${first.scene.id} overlaps ${second.scene.id}`);
    }
  }
}
