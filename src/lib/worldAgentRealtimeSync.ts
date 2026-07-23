import type { AgentStep, WorldAgentStreamEvent, WorldRealtimeSnapshot } from '../types';

const REALTIME_WORLD_MUTATION_TOOLS = new Set<AgentStep['tool']>([
  'transition_scene',
  'leave_scene',
  'apply_world_patch',
]);

export function isSuccessfulRealtimeWorldMutationStep(step: AgentStep): boolean {
  return REALTIME_WORLD_MUTATION_TOOLS.has(step.tool) && step.result?.ok === true;
}

export function getWorldRealtimeSnapshot(
  event: WorldAgentStreamEvent,
): WorldRealtimeSnapshot | null {
  if (event.type !== 'step' || !isSuccessfulRealtimeWorldMutationStep(event.step)) return null;
  return event.realtimeSnapshot || null;
}
