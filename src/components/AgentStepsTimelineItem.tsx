import { ChevronDown, ChevronRight, ListTree, Wrench } from 'lucide-react';
import { useState } from 'react';
import type { AgentStep } from '../types';

interface AgentStepsTimelineItemProps {
  runId?: number;
  steps: AgentStep[];
  onLayoutChange?: (anchor: HTMLElement) => void;
}

const TOOL_LABELS: Record<string, string> = {
  search_entities: '搜索实体',
  get_entity_bundle: '读取实体详情',
  get_current_scene: '读取当前场景',
  get_scene_entities: '读取场景实体',
  get_relationships: '读取关系',
  enter_scene: '切换场景',
  apply_world_patch: '修改世界数据',
  finish: '生成最终回答',
};

export function AgentStepsTimelineItem({ runId, steps, onLayoutChange }: AgentStepsTimelineItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  if (!steps.length) return null;

  const labels = steps.map((step) => getToolLabel(step.tool));
  const uniqueLabels = Array.from(new Set(labels));
  const summary = `Agent 调用了 ${steps.length} 个工具：${uniqueLabels.join('、')}`;

  return (
    <section className="agent-timeline-item" aria-label="Agent 工具步骤">
      <button
        className="agent-timeline-summary"
        type="button"
        onMouseDownCapture={(event) => onLayoutChange?.(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            onLayoutChange?.(event.currentTarget);
          }
        }}
        onClick={(event) => {
          onLayoutChange?.(event.currentTarget);
          setIsOpen((current) => !current);
        }}
      >
        <span className="agent-timeline-icon">
          <ListTree size={17} />
        </span>
        <span className="agent-timeline-copy">
          <strong>{summary}</strong>
          <small>{runId ? `Run #${runId}` : '本轮后台工具调用记录'}</small>
        </span>
        {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>

      {isOpen ? (
        <div className="agent-timeline-steps">
          {steps.map((step, index) => (
            <article className="agent-timeline-step" key={`${step.tool}-${step.index ?? step.stepIndex ?? index}`}>
              <div className="agent-step-title">
                <span>{index + 1}</span>
                <Wrench size={15} />
                <strong>{getToolLabel(step.tool)}</strong>
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
          ))}
        </div>
      ) : null}
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
