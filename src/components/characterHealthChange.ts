export type CharacterHealthChangeKind = 'damage' | 'heal';

export interface CharacterHealthSnapshot {
  currentHitPoints: number;
  maxHitPoints: number;
}

export interface CharacterHealthChangeEvent {
  id: string;
  kind: CharacterHealthChangeKind;
  amount: number;
  fromPercentage: number;
  toPercentage: number;
}

export function createCharacterHealthChangeEvent(
  id: string,
  previous: CharacterHealthSnapshot,
  current: CharacterHealthSnapshot,
): CharacterHealthChangeEvent | null {
  const delta = current.currentHitPoints - previous.currentHitPoints;
  if (delta === 0) return null;
  const percentageMaxHitPoints = current.maxHitPoints;

  return {
    id,
    kind: delta > 0 ? 'heal' : 'damage',
    amount: Math.abs(delta),
    fromPercentage: getHealthPercentage(previous.currentHitPoints, percentageMaxHitPoints),
    toPercentage: getHealthPercentage(current.currentHitPoints, percentageMaxHitPoints),
  };
}

export function getHealthPercentage(currentHitPoints: number, maxHitPoints: number) {
  if (!Number.isFinite(maxHitPoints) || maxHitPoints <= 0) return 0;
  return clamp((currentHitPoints / maxHitPoints) * 100, 0, 100);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
