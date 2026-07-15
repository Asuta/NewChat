import type { PresentationStageCharacter } from '../types';

const STAGE_SLOTS = {
  1: ['center'],
  2: ['left', 'right'],
  3: ['left', 'center', 'right'],
} as const;

export function getVisibleStageCharacters(
  characters: PresentationStageCharacter[],
  activeSpeakerId?: string,
  feedbackTargetId?: string,
): PresentationStageCharacter[] {
  const speaker = activeSpeakerId
    ? characters.find((character) => character.entityId === activeSpeakerId) || null
    : null;
  const firstThree = characters.slice(0, 3);
  let selected = speaker && !firstThree.some((character) => character.entityId === speaker.entityId)
    ? [...characters.filter((character) => character.entityId !== speaker.entityId).slice(0, 2), speaker]
    : firstThree;

  const feedbackTarget = feedbackTargetId
    ? characters.find((character) => character.entityId === feedbackTargetId) || null
    : null;
  if (feedbackTarget && !selected.some((character) => character.entityId === feedbackTarget.entityId)) {
    if (selected.length < 3) {
      selected = [...selected, feedbackTarget];
    } else {
      let replacementIndex = -1;
      for (let index = selected.length - 1; index >= 0; index -= 1) {
        if (selected[index].entityId === speaker?.entityId) continue;
        replacementIndex = index;
        break;
      }
      if (replacementIndex >= 0) {
        selected = selected.map((character, index) => (
          index === replacementIndex ? feedbackTarget : character
        ));
      }
    }
  }

  const slots = STAGE_SLOTS[Math.min(selected.length, 3) as keyof typeof STAGE_SLOTS] || STAGE_SLOTS[1];
  return selected.map((character, index) => ({
    ...character,
    slot: selected.length === 1 && character.position && character.position !== 'auto'
      ? character.position
      : slots[index] || 'center',
  }));
}
