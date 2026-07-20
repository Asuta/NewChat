import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStageDialogueUnreadState,
  markStageDialoguePageRead,
  reconcileStageDialogueUnreadState,
  resolveStageDialogueKeyboardAction,
} from './stageDialogueNavigation';

test('new dialogue pages remain unread until the player visits them', () => {
  const initial = createStageDialogueUnreadState('run-1', 'entry-1:10', ['page-1']);
  const updated = reconcileStageDialogueUnreadState(
    initial,
    'run-1',
    'entry-1:30',
    ['page-1', 'page-2', 'page-3'],
  );

  assert.deepEqual(updated.unreadPageIds, ['page-2', 'page-3']);
  assert.deepEqual(markStageDialoguePageRead(updated, 'run-1', 'page-2').unreadPageIds, ['page-3']);
});

test('returning to a previous page does not make it unread again', () => {
  const initial = createStageDialogueUnreadState('run-1', 'entry-1:10', ['page-1']);
  const updated = reconcileStageDialogueUnreadState(initial, 'run-1', 'entry-1:20', ['page-1', 'page-2']);
  const read = markStageDialoguePageRead(updated, 'run-1', 'page-2');

  assert.deepEqual(
    reconcileStageDialogueUnreadState(read, 'run-1', 'entry-1:20', ['page-1', 'page-2']).unreadPageIds,
    [],
  );
});

test('a new dialogue sequence starts without stale unread pages', () => {
  const initial = createStageDialogueUnreadState('run-1', 'entry-1:10', ['page-1']);
  const updated = reconcileStageDialogueUnreadState(initial, 'run-1', 'entry-1:20', ['page-1', 'page-2']);

  assert.deepEqual(
    reconcileStageDialogueUnreadState(
      updated,
      'run-2',
      'entry-2:20',
      ['next-page-1', 'next-page-2'],
    ),
    createStageDialogueUnreadState('run-2', 'entry-2:20', ['next-page-1', 'next-page-2']),
  );
});

test('layout-only repagination does not create unread dialogue', () => {
  const initial = createStageDialogueUnreadState('run-1', 'entry-1:30', ['page-1', 'page-2']);
  const widerLayout = reconcileStageDialogueUnreadState(initial, 'run-1', 'entry-1:30', ['page-1']);
  const narrowerAgain = reconcileStageDialogueUnreadState(
    widerLayout,
    'run-1',
    'entry-1:30',
    ['page-1', 'page-2'],
  );

  assert.deepEqual(widerLayout.unreadPageIds, []);
  assert.deepEqual(narrowerAgain.unreadPageIds, []);
});

test('left and right arrows map to dialogue navigation without claiming other keys', () => {
  assert.equal(resolveStageDialogueKeyboardAction('ArrowLeft'), 'previous');
  assert.equal(resolveStageDialogueKeyboardAction('ArrowRight'), 'advance');
  assert.equal(resolveStageDialogueKeyboardAction('Enter'), null);
});
