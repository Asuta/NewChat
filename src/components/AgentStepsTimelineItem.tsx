import { Wrench } from 'lucide-react';
import type { AgentStep } from '../types';

interface AgentStepTimelineItemProps {
  runId?: number;
  step: AgentStep;
  onLayoutChange?: (anchor: HTMLElement) => void;
}

const TOOL_LABELS: Record<string, string> = {
  search_entities: '搜索实体',
  get_entity_bundle: '读取实体详情',
  get_current_scene: '读取当前场景',
  get_scene_entities: '读取场景实体',
  get_relationships: '读取关系',
  get_rule_toc: '读取规则目录',
  search_rules: '搜索规则',
  get_rule_section: '读取规则段落',
  roll_dice: '掷骰',
  dm_speak: 'DM 发言',
  npc_speak: 'NPC 发言',
  get_time_state: '读取世界时间',
  update_time: '结算剧情时间',
  transition_scene: '推进时间并切换场景',
  enter_scene: '切换场景',
  apply_world_patch: '修改世界数据',
};

export function AgentStepTimelineItem({ runId, step, onLayoutChange }: AgentStepTimelineItemProps) {
  const stepIndex = typeof step.stepIndex === 'number' ? step.stepIndex : typeof step.index === 'number' ? step.index : null;

  return (
    <section className="agent-timeline-item" aria-label="Agent 工具步骤">
      <article className="agent-timeline-step">
        <div className="agent-step-title">
          <span>{stepIndex ?? '·'}</span>
          <Wrench size={15} />
          <strong>{getToolLabel(step.tool)}</strong>
          {runId ? <small>Run #{runId}</small> : null}
        </div>
        <p>{formatStepResult(step.result)}</p>
        <details onMouseDownCapture={(event) => onLayoutChange?.(event.currentTarget)}>
          <summary>查看详情</summary>
          <div className="agent-step-json-grid">
            <JsonBlock title="参数" value={step.args} />
            <JsonBlock title="结果" value={step.result} />
          </div>
        </details>
      </article>
    </section>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="agent-step-json">
      <span>{title}</span>
      <pre>{formatJson(value)}</pre>
    </div>
  );
}

function getToolLabel(tool: string) {
  return TOOL_LABELS[tool] || tool;
}

function formatStepResult(result: Record<string, unknown> | undefined) {
  if (!result) return '已执行。';
  const summary = result.summary;
  if (typeof summary === 'string' && summary.trim()) return summary;
  const error = result.error;
  if (typeof error === 'string' && error.trim()) return error;
  const answer = result.answer;
  if (typeof answer === 'string' && answer.trim()) return answer;
  return result.ok === false ? '工具调用失败。' : '已执行。';
}

function formatJson(value: unknown) {
  return JSON.stringify(removeUndefined(value), null, 2);
}

function removeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeUndefined);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, removeUndefined(entryValue)]),
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
