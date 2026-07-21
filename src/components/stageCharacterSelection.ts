import type { PresentationStageCharacter } from '../types';

const STAGE_SLOTS = {
  1: ['center'],
  2: ['left', 'right'],
  3: ['left', 'center', 'right'],
} as const;

const CROWDED_STAGE_EDGE_PERCENT = 10;
const CROWDED_CHARACTER_WIDTH_PERCENT = 28;
const CROWDED_CHARACTER_GAP_RATIO = 0.9;
const MAX_CROWD_SCALE = 0.9;

export function getVisibleStageCharacters(
  characters: PresentationStageCharacter[],
): PresentationStageCharacter[] {
  const characterCount = characters.length;
  const slots = STAGE_SLOTS[characterCount as keyof typeof STAGE_SLOTS];
  const availableWidth = 100 - (CROWDED_STAGE_EDGE_PERCENT * 2);
  const characterSpacing = characterCount > 1 ? availableWidth / (characterCount - 1) : availableWidth;
  const crowdScale = characterCount > 3
    ? Math.min(
        MAX_CROWD_SCALE,
        (characterSpacing / CROWDED_CHARACTER_WIDTH_PERCENT) * CROWDED_CHARACTER_GAP_RATIO,
      )
    : 1;

  return characters.map((character, index) => {
    if (slots) {
      return {
        ...character,
        slot: characterCount === 1 && character.position && character.position !== 'auto'
          ? character.position
          : slots[index],
        stageCrowdScale: 1,
        stageLeftPercent: undefined,
        stageWidthPercent: undefined,
      };
    }

    const bindingScale = Math.abs(character.scale || 1);
    return {
      ...character,
      slot: 'crowded',
      stageCrowdScale: crowdScale / Math.max(1, bindingScale),
      stageLeftPercent: CROWDED_STAGE_EDGE_PERCENT + ((availableWidth * index) / (characterCount - 1)),
      stageWidthPercent: CROWDED_CHARACTER_WIDTH_PERCENT,
    };
  });
}
