import { z } from 'zod';

export const ENTITY_KINDS = ['player', 'character', 'scene', 'item', 'quest', 'event', 'faction', 'lore'];
export const COMPONENT_TYPES = ['identity', 'scene', 'stats', 'status', 'memory', 'inventory', 'quest', 'schedule'];
export const RELATIONSHIP_TYPES = [
  'located_in',
  'ownership',
  'exit_to',
  'knows',
  'trust',
  'affinity',
  'hostility',
  'fear',
  'belongs_to',
  'unlocks',
  'requires',
  'mentions',
  'related_to',
];

const numberValue = z.number().finite();

export const componentSchemas = {
  identity: z
    .object({
      role: z.string().optional(),
      description: z.string().optional(),
      background: z.string().optional(),
      personality: z.array(z.string()).optional(),
      effect: z.record(z.string(), z.unknown()).optional(),
      notes: z.string().optional(),
    })
    .passthrough(),
  scene: z
    .object({
      description: z.string(),
      exits: z.array(z.string()).default([]),
      tags: z.array(z.string()).optional(),
      visibility: z.string().optional(),
    })
    .passthrough(),
  stats: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.null()])).default({}),
  status: z
    .object({
      state: z.string(),
      label: z.string(),
      description: z.string(),
      canAct: z.boolean(),
    })
    .passthrough(),
  memory: z
    .object({
      entries: z
        .array(
          z
            .object({
              id: z.string(),
              summary: z.string(),
              source: z.string(),
              relatedEntityIds: z.array(z.string()).optional(),
              createdAt: z.string().optional(),
            })
            .passthrough(),
        )
        .optional(),
    })
    .passthrough(),
  inventory: z
    .object({
      items: z.array(z.string()).default([]),
    })
    .passthrough(),
  quest: z
    .object({
      status: z.enum(['inactive', 'active', 'completed', 'failed']),
      title: z.string(),
      description: z.string().optional(),
      objectives: z.array(z.record(z.string(), z.unknown())).default([]),
      participants: z.array(z.string()).optional(),
    })
    .passthrough(),
  schedule: z
    .object({
      entries: z.array(z.record(z.string(), z.unknown())).default([]),
    })
    .passthrough(),
};

export const relationshipSchemas = {
  located_in: z.record(z.string(), z.unknown()).default({}),
  ownership: z.record(z.string(), z.unknown()).default({}),
  exit_to: z.record(z.string(), z.unknown()).default({}),
  knows: z.record(z.string(), z.unknown()).default({}),
  trust: z.record(z.string(), z.unknown()).default({}),
  affinity: z.record(z.string(), z.unknown()).default({}),
  hostility: z.record(z.string(), z.unknown()).default({}),
  fear: z.record(z.string(), z.unknown()).default({}),
  belongs_to: z.record(z.string(), z.unknown()).default({}),
  unlocks: z.record(z.string(), z.unknown()).default({}),
  requires: z.record(z.string(), z.unknown()).default({}),
  mentions: z.record(z.string(), z.unknown()).default({}),
  related_to: z.record(z.string(), z.unknown()).default({}),
};

export function isEntityKind(kind) {
  return ENTITY_KINDS.includes(kind);
}

export function isComponentType(type) {
  return COMPONENT_TYPES.includes(type);
}

export function isRelationshipType(type) {
  return RELATIONSHIP_TYPES.includes(type);
}

export function validateComponentData(type, data) {
  if (!isComponentType(type)) {
    return { ok: false, error: `未知 ComponentType：${type}` };
  }
  const result = componentSchemas[type].safeParse(normalizeComponentData(type, data));
  if (!result.success) {
    return { ok: false, error: z.prettifyError(result.error) };
  }
  return { ok: true, data: result.data };
}

function normalizeComponentData(type, data) {
  if (type !== 'status') return data ?? {};
  if (!isRecord(data)) return data ?? {};

  const next = { ...data };
  const conditions = Array.isArray(next.conditions) ? next.conditions.map((condition) => String(condition)) : [];
  const alive = next.alive !== false && next.state !== 'dead';
  const conscious = next.conscious !== false && next.state !== 'unconscious';
  const cannotActByCondition = conditions.some((condition) =>
    ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious', '昏迷', '失能', '麻痹', '石化', '震慑'].includes(condition),
  );

  if (typeof next.state !== 'string') {
    next.state = !alive ? 'dead' : !conscious ? 'unconscious' : 'active';
  }
  if (typeof next.label !== 'string') {
    next.label = !alive ? '死亡' : !conscious ? '昏迷' : '正常';
  }
  if (typeof next.description !== 'string') {
    next.description = !alive ? '该角色已经死亡。' : !conscious ? '该角色失去意识，暂时无法行动。' : '该角色状态正常，可以行动。';
  }
  if (typeof next.canAct !== 'boolean') {
    next.canAct = alive && conscious && !cannotActByCondition;
  }

  return next;
}

export function validateRelationshipInput(type, value, data) {
  if (!isRelationshipType(type)) {
    return { ok: false, error: `未知 RelationshipType：${type}` };
  }
  if (value !== undefined && value !== null && !numberValue.safeParse(value).success) {
    return { ok: false, error: `${type} relationship 的 value 只能是 number 或 null。` };
  }
  const result = relationshipSchemas[type].safeParse(data ?? {});
  if (!result.success) {
    return { ok: false, error: z.prettifyError(result.error) };
  }
  return { ok: true, value: value ?? null, data: result.data };
}

export function listWorldSchemas() {
  return {
    entityKinds: ENTITY_KINDS,
    componentTypes: COMPONENT_TYPES,
    relationshipTypes: RELATIONSHIP_TYPES,
  };
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
