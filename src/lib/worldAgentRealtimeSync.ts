import type {
  ActionResult,
  AgentStep,
  WorldAgentStreamEvent,
  WorldRealtimeSnapshot,
} from '../types';

const REALTIME_WORLD_MUTATION_TOOLS = new Set<AgentStep['tool']>([
  'execute_world_action',
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

export function getExecutedWorldActionResult(
  step: AgentStep,
): { eventId: number | string; result: ActionResult } | null {
  if (step.tool !== 'execute_world_action' || step.result?.ok !== true) return null;

  const eventId = step.result.eventId;
  const result = step.result.result;
  if (
    (typeof eventId !== 'number' && typeof eventId !== 'string')
    || !eventId.toString().trim()
    || !result
    || typeof result !== 'object'
    || Array.isArray(result)
  ) return null;

  return {
    eventId,
    result: result as ActionResult,
  };
}
