export type StageDialogueKeyboardAction = 'previous' | 'advance';

export interface StageDialogueUnreadState {
  sequenceKey: string;
  sourceVersion: string;
  knownPageIds: string[];
  unreadPageIds: string[];
}

export function createStageDialogueUnreadState(
  sequenceKey: string,
  sourceVersion: string,
  pageIds: readonly string[],
): StageDialogueUnreadState {
  return {
    sequenceKey,
    sourceVersion,
    knownPageIds: uniquePageIds(pageIds),
    unreadPageIds: [],
  };
}

export function reconcileStageDialogueUnreadState(
  current: StageDialogueUnreadState,
  sequenceKey: string,
  sourceVersion: string,
  pageIds: readonly string[],
): StageDialogueUnreadState {
  const nextPageIds = uniquePageIds(pageIds);
  if (current.sequenceKey !== sequenceKey) {
    return createStageDialogueUnreadState(sequenceKey, sourceVersion, nextPageIds);
  }

  const didSourceUpdate = current.sourceVersion !== sourceVersion;
  const knownPageIds = new Set(current.knownPageIds);
  const availablePageIds = new Set(nextPageIds);
  const unreadPageIds = current.unreadPageIds.filter((pageId) => availablePageIds.has(pageId));
  const unreadPageIdSet = new Set(unreadPageIds);

  for (const pageId of nextPageIds) {
    if (!didSourceUpdate || knownPageIds.has(pageId) || unreadPageIdSet.has(pageId)) continue;
    unreadPageIds.push(pageId);
    unreadPageIdSet.add(pageId);
  }

  if (
    current.sourceVersion === sourceVersion
    && samePageIds(current.knownPageIds, nextPageIds)
    && samePageIds(current.unreadPageIds, unreadPageIds)
  ) {
    return current;
  }

  return {
    sequenceKey,
    sourceVersion,
    knownPageIds: nextPageIds,
    unreadPageIds,
  };
}

export function markStageDialoguePageRead(
  current: StageDialogueUnreadState,
  sequenceKey: string,
  pageId: string,
): StageDialogueUnreadState {
  if (current.sequenceKey !== sequenceKey || !current.unreadPageIds.includes(pageId)) return current;
  return {
    ...current,
    unreadPageIds: current.unreadPageIds.filter((unreadPageId) => unreadPageId !== pageId),
  };
}

export function resolveStageDialogueKeyboardAction(key: string): StageDialogueKeyboardAction | null {
  if (key === 'ArrowLeft') return 'previous';
  if (key === 'ArrowRight') return 'advance';
  return null;
}

function uniquePageIds(pageIds: readonly string[]) {
  return [...new Set(pageIds.filter(Boolean))];
}

function samePageIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((pageId, index) => pageId === right[index]);
}
