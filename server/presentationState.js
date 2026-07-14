const DEAD_STATES = new Set(['dead', 'deceased', '死亡']);
const INCAPACITATED_STATES = new Set([
  'incapacitated',
  'unconscious',
  '失能',
  '昏迷',
]);

export function derivePresentationVitalState(status, health) {
  const state = normalizeStateToken(status?.state);
  const conditions = Array.isArray(status?.conditions)
    ? status.conditions.map(normalizeStateToken)
    : [];

  if (status?.alive === false || DEAD_STATES.has(state) || conditions.some((condition) => DEAD_STATES.has(condition))) {
    return 'dead';
  }

  if (
    status?.conscious === false
    || INCAPACITATED_STATES.has(state)
    || conditions.some((condition) => INCAPACITATED_STATES.has(condition))
    || Number(health?.currentHitPoints) <= 0
  ) {
    return 'incapacitated';
  }

  return 'active';
}

function normalizeStateToken(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
