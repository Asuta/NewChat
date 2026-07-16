import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import type { PortraitState, PresentationStageCharacter, WorldActionMenuTarget } from '../types';
import type { CharacterAttackFeedbackEvent } from './characterAttackFeedback';
import {
  createCharacterHealthChangeEvent,
  getHealthPercentage,
  type CharacterHealthChangeEvent,
  type CharacterHealthSnapshot,
} from './characterHealthChange';
import { resolveCharacterPortrait } from './portraitState';

const CHARACTER_ALPHA_MASK_MAX_SIZE = 512;
const CHARACTER_ALPHA_HIT_THRESHOLD = 16;

interface GameStageCharacterProps {
  character: PresentationStageCharacter;
  portraitState: PortraitState;
  attackFeedbackEvent?: CharacterAttackFeedbackEvent;
  healthChangeEvent?: CharacterHealthChangeEvent;
  isSpeaking: boolean;
  isPixelHovered: boolean;
  isActionMenuOpen: boolean;
  isItemTargeting?: boolean;
  isValidItemTarget?: boolean;
  itemTargetingKind?: 'use' | 'attack';
  onAlphaHoverChange: (entityId: string | null) => void;
  onItemTarget?: (entityId: string) => void;
  onCancelItemTargeting?: () => void;
  onOpenEntityActions?: (target: WorldActionMenuTarget) => void;
}

export function GameStageCharacter({
  character,
  portraitState,
  attackFeedbackEvent,
  healthChangeEvent,
  isSpeaking,
  isPixelHovered,
  isActionMenuOpen,
  isItemTargeting = false,
  isValidItemTarget = false,
  itemTargetingKind = 'use',
  onAlphaHoverChange,
  onItemTarget,
  onCancelItemTargeting,
  onOpenEntityActions,
}: GameStageCharacterProps) {
  const figureRef = useRef<HTMLElement>(null);
  const resolvedPortrait = resolveCharacterPortrait(
    character,
    portraitState,
    attackFeedbackEvent?.hit === true,
  );
  const vitalStatus = getVitalStatus(character.vitalState);

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure || !healthChangeEvent) return;

    const visual = figure.querySelector<HTMLElement>(':scope > img, :scope > .game-character-missing');
    const caption = figure.querySelector<HTMLElement>(':scope > figcaption');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isHealing = healthChangeEvent.kind === 'heal';
    const animations: Animation[] = [];

    if (visual && typeof visual.animate === 'function') {
      const baseFilter = getComputedStyle(visual).filter;
      const effectFilterValue = isHealing
        ? 'sepia(0.36) saturate(1.9) hue-rotate(72deg) brightness(1.2)'
        : 'sepia(0.72) saturate(2.4) brightness(1.22)';
      const effectFilter = baseFilter === 'none'
        ? effectFilterValue
        : `${baseFilter} ${effectFilterValue}`;
      animations.push(visual.animate(
        prefersReducedMotion
          ? [
              { filter: baseFilter },
              { filter: effectFilter, offset: 0.34 },
              { filter: baseFilter },
            ]
          : isHealing
            ? [
                { filter: baseFilter, translate: '0 0' },
                { filter: effectFilter, translate: '0 -7px', offset: 0.3 },
                { filter: effectFilter, translate: '0 -3px', offset: 0.62 },
                { filter: baseFilter, translate: '0 0' },
              ]
          : [
              { filter: baseFilter, translate: '0 0' },
              { filter: effectFilter, translate: '-9px 0', offset: 0.2 },
              { filter: effectFilter, translate: '7px 0', offset: 0.38 },
              { filter: effectFilter, translate: '-4px 0', offset: 0.56 },
              { filter: baseFilter, translate: '0 0' },
            ],
        { duration: prefersReducedMotion ? 280 : isHealing ? 520 : 380, easing: 'ease-out' },
      ));
    }

    if (caption && typeof caption.animate === 'function') {
      const styles = getComputedStyle(caption);
      animations.push(caption.animate([
        { backgroundColor: styles.backgroundColor, borderColor: styles.borderColor },
        {
          backgroundColor: isHealing ? 'rgba(13, 66, 44, 0.88)' : 'rgba(78, 18, 22, 0.88)',
          borderColor: isHealing ? 'rgba(111, 239, 170, 0.82)' : 'rgba(255, 119, 119, 0.82)',
          offset: 0.3,
        },
        { backgroundColor: styles.backgroundColor, borderColor: styles.borderColor },
      ], { duration: isHealing ? 560 : 460, easing: 'ease-out' }));
    }

    return () => animations.forEach((animation) => animation.cancel());
  }, [healthChangeEvent]);

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure || !attackFeedbackEvent || attackFeedbackEvent.hit) return;

    const visual = figure.querySelector<HTMLElement>(':scope > img, :scope > .game-character-missing');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!visual || prefersReducedMotion || typeof visual.animate !== 'function') return;

    const animation = visual.animate([
      { translate: '0 0' },
      { translate: '11px -1px', offset: 0.3 },
      { translate: '-3px 0', offset: 0.64 },
      { translate: '0 0' },
    ], { duration: 460, easing: 'cubic-bezier(0.2, 0.78, 0.24, 1)' });
    return () => animation.cancel();
  }, [attackFeedbackEvent]);

  const displayedCurrentHitPoints = character.vitalState === 'dead'
    ? 0
    : character.health?.currentHitPoints ?? 0;
  const healthPercentage = character.health
    ? getHealthPercentage(displayedCurrentHitPoints, character.health.maxHitPoints)
    : 0;
  const hasPointerInteraction = Boolean(onOpenEntityActions || isItemTargeting);

  function handleContextMenu(event: ReactMouseEvent<HTMLElement>) {
    if (!hasPointerInteraction) return;
    event.preventDefault();
    event.stopPropagation();
    if (isItemTargeting) {
      onCancelItemTargeting?.();
      return;
    }
    if (
      event.target instanceof HTMLImageElement
      && !isCharacterImagePointOpaque(event.target, event.clientX, event.clientY)
    ) return;
    onOpenEntityActions?.({
      entityId: character.entityId,
      entityName: character.name,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }

  function handleClick(event: ReactMouseEvent<HTMLElement>) {
    if (!isItemTargeting) return;
    event.preventDefault();
    event.stopPropagation();
    if (!isValidItemTarget || !onItemTarget) return;
    if (
      event.target instanceof HTMLImageElement
      && !isCharacterImagePointOpaque(event.target, event.clientX, event.clientY)
    ) return;
    onItemTarget(character.entityId);
  }

  return (
    <figure
      className={[
        'game-character',
        `slot-${character.slot}`,
        resolvedPortrait.isFallback ? 'fallback-character' : '',
        `portrait-state-${resolvedPortrait.state}`,
        isSpeaking ? 'speaking-character' : '',
        hasPointerInteraction ? 'has-actions' : '',
        isPixelHovered ? 'pixel-hovered' : '',
        isActionMenuOpen ? 'action-menu-open' : '',
        isItemTargeting ? 'item-targeting' : '',
        isItemTargeting && isValidItemTarget ? 'item-target-valid' : '',
        isItemTargeting && !isValidItemTarget ? 'item-target-invalid' : '',
        isItemTargeting && isValidItemTarget && itemTargetingKind === 'attack' ? 'item-target-attack' : '',
        `is-${character.vitalState}`,
      ].filter(Boolean).join(' ')}
      ref={figureRef}
      style={{ '--character-scale': String(character.scale || 1) } as CSSProperties}
      onClick={isItemTargeting ? handleClick : undefined}
      onContextMenu={hasPointerInteraction ? handleContextMenu : undefined}
    >
      {resolvedPortrait.url ? (
        <img
          key={resolvedPortrait.url}
          src={resolvedPortrait.url}
          alt={vitalStatus ? `${character.name}（${vitalStatus.label}）` : character.name}
          onLoad={(event) => prepareCharacterAlphaMask(event.currentTarget)}
          onPointerMove={hasPointerInteraction ? (event) => {
            if (event.pointerType === 'touch') return;
            const isOpaque = isCharacterImagePointOpaque(event.currentTarget, event.clientX, event.clientY);
            onAlphaHoverChange(
              isOpaque && (!isItemTargeting || isValidItemTarget)
                ? character.entityId
                : null,
            );
          } : undefined}
          onPointerLeave={hasPointerInteraction ? () => {
            if (isPixelHovered) onAlphaHoverChange(null);
          } : undefined}
        />
      ) : (
        <div className="game-character-missing" />
      )}
      {attackFeedbackEvent ? (
        <span
          className={`game-character-attack-feedback is-${attackFeedbackEvent.hit ? 'hit' : 'miss'}`}
          key={attackFeedbackEvent.id}
          aria-hidden="true"
        >
          <span className="game-character-attack-slash" />
          <span className="game-character-attack-flare" />
          {attackFeedbackEvent.hit ? null : <span className="game-character-miss-label">MISS</span>}
        </span>
      ) : null}
      {healthChangeEvent ? (
        <span
          className={`game-character-health-number is-${healthChangeEvent.kind}`}
          key={healthChangeEvent.id}
          aria-hidden="true"
        >
          {healthChangeEvent.kind === 'heal' ? '+' : '-'}{healthChangeEvent.amount}
        </span>
      ) : null}
      <figcaption className={[
        character.health ? 'has-health' : '',
        vitalStatus ? 'has-vital-status' : '',
      ].filter(Boolean).join(' ') || undefined}>
        <span className="game-character-caption-row">
          <span className="game-character-name">{character.name}</span>
          {vitalStatus ? (
            <span
              className={`game-character-vital-status ${vitalStatus.className}`}
              role="status"
              aria-label={`${character.name}${vitalStatus.announcement}`}
            >
              {vitalStatus.label}
            </span>
          ) : character.health ? (
            <span className="game-character-health-value" aria-hidden="true">
              {character.health.currentHitPoints}/{character.health.maxHitPoints}
            </span>
          ) : null}
        </span>
        {character.health ? (
          <span
            className="game-character-health-track"
            role="meter"
            aria-label={`${character.name} 生命值`}
            aria-valuemin={0}
            aria-valuemax={character.health.maxHitPoints}
            aria-valuenow={displayedCurrentHitPoints}
            aria-valuetext={`${displayedCurrentHitPoints}/${character.health.maxHitPoints}`}
          >
            {healthChangeEvent?.kind === 'damage' ? (
              <span
                className="game-character-health-loss"
                key={healthChangeEvent.id}
                style={{
                  '--health-before': `${healthChangeEvent.fromPercentage}%`,
                  '--health-after': `${healthChangeEvent.toPercentage}%`,
                } as CSSProperties}
              />
            ) : null}
            {healthChangeEvent?.kind === 'heal' ? (
              <span
                className="game-character-health-gain"
                key={healthChangeEvent.id}
                style={{
                  '--health-before': `${healthChangeEvent.fromPercentage}%`,
                  '--health-after': `${healthChangeEvent.toPercentage}%`,
                } as CSSProperties}
              />
            ) : null}
            <span
              className={`game-character-health-fill ${getHealthTone(displayedCurrentHitPoints, character.health.maxHitPoints)}`}
              style={{ width: `${healthPercentage}%` }}
            />
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

export function useCharacterHealthFeedback(
  sequenceKey: string,
  characters: PresentationStageCharacter[],
) {
  const snapshotRef = useRef<{
    sequenceKey: string;
    healthByEntity: Map<string, CharacterHealthSnapshot>;
  } | null>(null);
  const eventCounterRef = useRef(0);
  const [eventsByEntity, setEventsByEntity] = useState<Record<string, CharacterHealthChangeEvent>>({});
  const [announcement, setAnnouncement] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    const healthByEntity = new Map<string, CharacterHealthSnapshot>();
    for (const character of characters) {
      if (!character.health) continue;
      healthByEntity.set(character.entityId, {
        currentHitPoints: character.health.currentHitPoints,
        maxHitPoints: character.health.maxHitPoints,
      });
    }

    const previousSnapshot = snapshotRef.current;
    snapshotRef.current = { sequenceKey, healthByEntity };
    const sequenceChanged = !previousSnapshot || previousSnapshot.sequenceKey !== sequenceKey;
    if (sequenceChanged) {
      setEventsByEntity((current) => Object.keys(current).length ? {} : current);
      setAnnouncement(null);
      return;
    }

    const detectedEvents: Array<CharacterHealthChangeEvent & { entityId: string; name: string }> = [];
    for (const character of characters) {
      if (!character.health) continue;
      const previousHealth = previousSnapshot.healthByEntity.get(character.entityId);
      if (!previousHealth || character.health.currentHitPoints === previousHealth.currentHitPoints) continue;

      eventCounterRef.current += 1;
      const event = createCharacterHealthChangeEvent(
        `${character.entityId}:${eventCounterRef.current}`,
        previousHealth,
        character.health,
      );
      if (!event) continue;
      detectedEvents.push({
        ...event,
        entityId: character.entityId,
        name: character.name,
      });
    }

    const visibleEntityIds = new Set(healthByEntity.keys());
    setEventsByEntity((current) => {
      const next = { ...current };
      let changed = false;
      for (const entityId of Object.keys(next)) {
        if (visibleEntityIds.has(entityId)) continue;
        delete next[entityId];
        changed = true;
      }
      for (const event of detectedEvents) {
        next[event.entityId] = event;
        changed = true;
      }
      return changed ? next : current;
    });

    if (detectedEvents.length) {
      setAnnouncement({
        id: detectedEvents.map((event) => event.id).join('|'),
        text: detectedEvents.map((event) => event.kind === 'heal'
          ? `${event.name}恢复${event.amount}点生命`
          : `${event.name}受到${event.amount}点伤害`).join('，'),
      });
    }
  }, [characters, sequenceKey]);

  return { eventsByEntity, announcement };
}

function getHealthTone(currentHitPoints: number, maxHitPoints: number) {
  const ratio = currentHitPoints / maxHitPoints;
  if (ratio <= 0.25) return 'is-critical';
  if (ratio <= 0.5) return 'is-wounded';
  return 'is-healthy';
}

function getVitalStatus(vitalState: PresentationStageCharacter['vitalState']) {
  if (vitalState === 'dead') {
    return { label: '已死亡', announcement: '已经死亡', className: 'is-dead' };
  }
  if (vitalState === 'incapacitated') {
    return { label: '失能', announcement: '已经失能', className: 'is-incapacitated' };
  }
  return null;
}

interface CharacterAlphaMask {
  width: number;
  height: number;
  alpha: Uint8Array;
}

interface CharacterAlphaMaskCacheEntry {
  source: string;
  mask: CharacterAlphaMask | null;
}

const characterAlphaMaskCache = new WeakMap<HTMLImageElement, CharacterAlphaMaskCacheEntry>();

function prepareCharacterAlphaMask(image: HTMLImageElement) {
  const source = image.currentSrc || image.src;
  const cached = characterAlphaMaskCache.get(image);
  if (cached?.source === source || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;

  const scale = Math.min(1, CHARACTER_ALPHA_MASK_MAX_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    characterAlphaMaskCache.set(image, { source, mask: null });
    return;
  }

  try {
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const alpha = new Uint8Array(width * height);
    for (let sourceIndex = 3, alphaIndex = 0; sourceIndex < pixels.length; sourceIndex += 4, alphaIndex += 1) {
      alpha[alphaIndex] = pixels[sourceIndex];
    }
    characterAlphaMaskCache.set(image, { source, mask: { width, height, alpha } });
  } catch {
    // Preserve the rectangular interaction if a cross-origin image cannot be sampled.
    characterAlphaMaskCache.set(image, { source, mask: null });
  }
}

function isCharacterImagePointOpaque(image: HTMLImageElement, clientX: number, clientY: number) {
  prepareCharacterAlphaMask(image);
  const entry = characterAlphaMaskCache.get(image);
  if (!entry?.mask) return true;

  const bounds = image.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return false;
  const relativeX = (clientX - bounds.left) / bounds.width;
  const relativeY = (clientY - bounds.top) / bounds.height;
  if (relativeX < 0 || relativeX >= 1 || relativeY < 0 || relativeY >= 1) return false;

  const x = Math.min(entry.mask.width - 1, Math.floor(relativeX * entry.mask.width));
  const y = Math.min(entry.mask.height - 1, Math.floor(relativeY * entry.mask.height));
  return entry.mask.alpha[y * entry.mask.width + x] >= CHARACTER_ALPHA_HIT_THRESHOLD;
}
