import type { ChatMessage, PortraitState, PresentationStageCharacter } from '../types';

export const PORTRAIT_STATES: PortraitState[] = [
  'neutral',
  'happy',
  'angry',
  'disappointed',
  'hurt',
  'wounded',
];

const PORTRAIT_STATE_SET = new Set<PortraitState>(PORTRAIT_STATES);

export function normalizePortraitState(value: unknown): PortraitState {
  return typeof value === 'string' && PORTRAIT_STATE_SET.has(value as PortraitState)
    ? value as PortraitState
    : 'neutral';
}

export function buildPortraitStatesByEntity(
  messages: ChatMessage[],
  currentSceneVisitId?: string,
): Record<string, PortraitState> {
  let result: Record<string, PortraitState> = {};
  for (const message of messages) {
    if (message.kind === 'scene-transition') {
      if (!currentSceneVisitId) result = {};
      continue;
    }
    const entityId = message.npcSpeech?.entityId;
    if (!entityId) continue;
    if (currentSceneVisitId && message.npcSpeech?.sceneVisitId !== currentSceneVisitId) continue;
    result[entityId] = normalizePortraitState(message.npcSpeech?.portraitState);
  }
  return result;
}

export function resolveCharacterPortrait(
  character: PresentationStageCharacter,
  requestedState: PortraitState = 'neutral',
  isHitReaction = false,
) {
  const healthRatio = character.health && character.health.maxHitPoints > 0
    ? character.health.currentHitPoints / character.health.maxHitPoints
    : 1;
  const targetState: PortraitState = isHitReaction
    ? 'hurt'
    : healthRatio <= 0.5
      ? 'wounded'
      : normalizePortraitState(requestedState);
  const targetUrl = character.portraitUrls[targetState];
  if (targetUrl) {
    return {
      state: targetState,
      url: targetUrl,
      isFallback: targetState === 'neutral' && character.isFallbackPortrait,
    };
  }
  return {
    state: 'neutral' as const,
    url: character.portraitUrls.neutral || character.portraitUrl,
    isFallback: character.isFallbackPortrait,
  };
}
