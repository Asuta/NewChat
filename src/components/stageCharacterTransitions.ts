import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { PresentationStageCharacter } from '../types';

export type StageCharacterMotionPhase =
  | 'stable'
  | 'entering'
  | 'exiting'
  | 'focus-entering'
  | 'focus-exiting';

export interface RenderedStageCharacter {
  character: PresentationStageCharacter;
  motionDelayMs: number;
  motionId: number;
  phase: StageCharacterMotionPhase;
}

interface StageCharacterSnapshot {
  sceneId: string;
  residents: PresentationStageCharacter[];
  visible: PresentationStageCharacter[];
}

const CHARACTER_ENTER_STAGGER_MS = 50;

export function classifyStageCharacterMotions(
  previousResidentIds: readonly string[],
  previousVisibleIds: readonly string[],
  nextResidentIds: readonly string[],
  nextVisibleIds: readonly string[],
): Record<string, StageCharacterMotionPhase> {
  const previousResidents = new Set(previousResidentIds);
  const previousVisible = new Set(previousVisibleIds);
  const nextResidents = new Set(nextResidentIds);
  const nextVisible = new Set(nextVisibleIds);
  const phases: Record<string, StageCharacterMotionPhase> = {};

  for (const entityId of nextVisibleIds) {
    if (previousVisible.has(entityId)) continue;
    phases[entityId] = previousResidents.has(entityId) ? 'focus-entering' : 'entering';
  }

  for (const entityId of previousVisibleIds) {
    if (nextVisible.has(entityId)) continue;
    phases[entityId] = nextResidents.has(entityId) ? 'focus-exiting' : 'exiting';
  }

  return phases;
}

export function useStageCharacterTransitions(
  sceneId: string,
  residents: PresentationStageCharacter[],
  visible: PresentationStageCharacter[],
) {
  const [rendered, setRendered] = useState<RenderedStageCharacter[]>(() => (
    visible.map((character) => createStableEntry(character))
  ));
  const snapshotRef = useRef<StageCharacterSnapshot>({ sceneId, residents, visible });
  const motionCounterRef = useRef(0);

  useLayoutEffect(() => {
    const previous = snapshotRef.current;
    snapshotRef.current = { sceneId, residents, visible };

    if (!sceneId || previous.sceneId !== sceneId) {
      setRendered(visible.map((character) => createStableEntry(character)));
      return;
    }

    const phases = classifyStageCharacterMotions(
      previous.residents.map(readEntityId),
      previous.visible.map(readEntityId),
      residents.map(readEntityId),
      visible.map(readEntityId),
    );

    setRendered((current) => {
      const currentByEntity = new Map(current.map((entry) => [entry.character.entityId, entry]));
      const nextVisibleIds = new Set(visible.map(readEntityId));
      let fullEnterIndex = 0;

      const nextRendered = visible.map((character): RenderedStageCharacter => {
        const existing = currentByEntity.get(character.entityId);
        const plannedPhase = phases[character.entityId];
        if (plannedPhase === 'entering' || plannedPhase === 'focus-entering') {
          motionCounterRef.current += 1;
          const motionDelayMs = plannedPhase === 'entering'
            ? fullEnterIndex++ * CHARACTER_ENTER_STAGGER_MS
            : 0;
          return {
            character,
            motionDelayMs,
            motionId: motionCounterRef.current,
            phase: plannedPhase,
          };
        }

        if (existing && isEnteringPhase(existing.phase)) {
          return { ...existing, character };
        }

        return createStableEntry(character, existing?.motionId ?? 0);
      });

      for (const previousCharacter of previous.visible) {
        if (nextVisibleIds.has(previousCharacter.entityId)) continue;
        const plannedPhase = phases[previousCharacter.entityId];
        if (plannedPhase !== 'exiting' && plannedPhase !== 'focus-exiting') continue;
        motionCounterRef.current += 1;
        nextRendered.push({
          character: currentByEntity.get(previousCharacter.entityId)?.character ?? previousCharacter,
          motionDelayMs: 0,
          motionId: motionCounterRef.current,
          phase: plannedPhase,
        });
      }

      const retainedIds = new Set(nextRendered.map((entry) => entry.character.entityId));
      for (const entry of current) {
        if (retainedIds.has(entry.character.entityId) || !isExitingPhase(entry.phase)) continue;
        nextRendered.push(entry);
      }

      return nextRendered;
    });
  }, [residents, sceneId, visible]);

  const completeMotion = useCallback((entityId: string, motionId: number) => {
    setRendered((current) => {
      const target = current.find((entry) => (
        entry.character.entityId === entityId && entry.motionId === motionId
      ));
      if (!target || target.phase === 'stable') return current;
      if (isExitingPhase(target.phase)) {
        return current.filter((entry) => entry !== target);
      }
      return current.map((entry) => entry === target
        ? { ...entry, motionDelayMs: 0, phase: 'stable' }
        : entry);
    });
  }, []);

  return { completeMotion, rendered };
}

export function isEnteringPhase(phase: StageCharacterMotionPhase) {
  return phase === 'entering' || phase === 'focus-entering';
}

export function isExitingPhase(phase: StageCharacterMotionPhase) {
  return phase === 'exiting' || phase === 'focus-exiting';
}

function createStableEntry(
  character: PresentationStageCharacter,
  motionId = 0,
): RenderedStageCharacter {
  return { character, motionDelayMs: 0, motionId, phase: 'stable' };
}

function readEntityId(character: PresentationStageCharacter) {
  return character.entityId;
}
