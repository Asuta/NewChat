import type { ActionResult } from '../types';

export interface CharacterAttackFeedbackEvent {
  id: string;
  targetEntityId: string;
  targetName: string;
  hit: boolean;
  critical: boolean;
}

export function createCharacterAttackFeedbackEvent(
  eventId: number | string,
  result: ActionResult,
): CharacterAttackFeedbackEvent | null {
  const normalizedEventId = String(eventId).trim();
  const action = result.action;
  if (
    !normalizedEventId
    || result.type !== 'attack.resolved'
    || (action?.kind !== 'attack.weapon' && action?.kind !== 'attack.unarmed')
    || typeof result.facts.hit !== 'boolean'
  ) return null;

  const targetEntityId = action.targetId.trim();
  if (!targetEntityId) return null;

  return {
    id: `attack:${normalizedEventId}`,
    targetEntityId,
    targetName: action.targetName?.trim() || targetEntityId,
    hit: result.facts.hit,
    critical: result.facts.critical === true,
  };
}
