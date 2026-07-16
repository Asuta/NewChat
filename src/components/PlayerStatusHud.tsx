import { Crown, Heart, Shield } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PresentationPlayerStatus } from '../types';
import { createCharacterHealthChangeEvent } from './characterHealthChange';

interface PlayerStatusHudProps {
  player: PresentationPlayerStatus;
}

interface PlayerHealthFeedback {
  id: string;
  kind: 'damage' | 'heal';
  amount: number;
}

export function PlayerStatusHud({ player }: PlayerStatusHudProps) {
  const previousHealthRef = useRef<{
    entityId: string;
    currentHitPoints: number;
    maxHitPoints: number;
  } | null>(null);
  const feedbackCounterRef = useRef(0);
  const [healthFeedback, setHealthFeedback] = useState<PlayerHealthFeedback | null>(null);
  const view = getPlayerStatusHudView(player);

  useEffect(() => {
    const health = player.health;
    if (!health) {
      previousHealthRef.current = null;
      setHealthFeedback(null);
      return;
    }

    const previous = previousHealthRef.current;
    previousHealthRef.current = { entityId: player.entityId, ...health };
    if (!previous || previous.entityId !== player.entityId) return;

    feedbackCounterRef.current += 1;
    const change = createCharacterHealthChangeEvent(
      `player:${feedbackCounterRef.current}`,
      previous,
      health,
    );
    if (!change) return;
    setHealthFeedback({ id: change.id, kind: change.kind, amount: change.amount });
  }, [player.entityId, player.health?.currentHitPoints, player.health?.maxHitPoints]);

  useEffect(() => {
    if (!healthFeedback) return;
    const feedbackId = healthFeedback.id;
    const timer = window.setTimeout(() => {
      setHealthFeedback((current) => current?.id === feedbackId ? null : current);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [healthFeedback]);

  return (
    <aside
      className={`player-status-hud is-${view.tone}${healthFeedback ? ` has-${healthFeedback.kind}` : ''}`}
      aria-label={`玩家状态：${player.name}`}
    >
      <span className="player-status-emblem" aria-hidden="true"><Crown size={18} /></span>
      <div className="player-status-content">
        <header>
          <strong>{player.name}</strong>
          {player.level === null ? null : <span>Lv.{player.level}</span>}
        </header>
        <div className="player-status-health-row">
          <span className="player-status-health-label"><Heart size={12} fill="currentColor" /> HP</span>
          <div
            className="player-status-health-track"
            role={player.health ? 'meter' : undefined}
            aria-label={player.health ? '玩家生命值' : '玩家生命值未知'}
            aria-valuemin={player.health ? 0 : undefined}
            aria-valuemax={player.health?.maxHitPoints}
            aria-valuenow={player.health?.currentHitPoints}
          >
            <span style={{ width: `${view.healthPercentage}%` }} />
          </div>
          <strong className="player-status-health-value">{view.healthText}</strong>
          {healthFeedback ? (
            <span className={`player-status-health-feedback is-${healthFeedback.kind}`} key={healthFeedback.id}>
              {healthFeedback.kind === 'heal' ? '+' : '-'}{formatHudNumber(healthFeedback.amount)}
            </span>
          ) : null}
        </div>
        <footer>
          <span><Shield size={12} /> 防御 {view.armorClassText}</span>
          <span className="player-status-condition"><i aria-hidden="true" />{view.statusLabel}</span>
        </footer>
      </div>
    </aside>
  );
}

export function getPlayerStatusHudView(player: PresentationPlayerStatus) {
  const hasHealth = Boolean(player.health && player.health.maxHitPoints > 0);
  const healthPercentage = hasHealth && player.health
    ? Math.min(100, Math.max(0, (player.health.currentHitPoints / player.health.maxHitPoints) * 100))
    : 0;
  const tone = player.vitalState === 'dead'
    ? 'dead'
    : player.vitalState === 'incapacitated' || !player.canAct
      ? 'incapacitated'
      : !hasHealth
        ? 'unknown'
        : healthPercentage <= 25
          ? 'critical'
          : healthPercentage <= 50
            ? 'wounded'
            : 'healthy';
  const statusLabel = tone === 'dead'
    ? '已死亡'
    : tone === 'incapacitated'
      ? player.statusLabel || '无法行动'
      : tone === 'unknown'
        ? player.statusLabel || '生命未知'
        : tone === 'critical'
          ? '濒危'
          : tone === 'wounded'
            ? '受伤'
            : player.statusLabel || '状态正常';

  return {
    healthPercentage,
    healthText: player.health
      ? `${formatHudNumber(player.health.currentHitPoints)} / ${formatHudNumber(player.health.maxHitPoints)}`
      : '-- / --',
    armorClassText: player.armorClass === null ? '--' : formatHudNumber(player.armorClass),
    statusLabel,
    tone,
  };
}

function formatHudNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
