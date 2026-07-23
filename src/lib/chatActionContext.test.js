import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCurrentActionContextEvents,
  createActionResultMessage,
} from './chat.ts';

function attackResult(summary, { hit, hpBefore, hpAfter }) {
  return {
    type: 'attack.resolved',
    facts: {
      hit,
      hpBefore,
      hpAfter,
    },
    stateChanges: hit
      ? [{ entityId: 'target', componentType: 'stats', path: 'currentHitPoints', from: hpBefore, to: hpAfter }]
      : [],
    narrationHints: {
      visibleEffects: hit ? [`目标受到 ${hpBefore - hpAfter} 点伤害。`] : ['目标避开了这次攻击。'],
    },
    summary,
  };
}

test('current action context excludes settled action results and prior internal transcripts', () => {
  const firstAttack = {
    ...createActionResultMessage(attackResult('第一次攻击命中，HP 10→8。', {
      hit: true,
      hpBefore: 10,
      hpAfter: 8,
    }), 7),
    id: 'action-1',
    createdAt: 2,
  };
  const secondAttack = {
    ...createActionResultMessage(attackResult('第二次攻击未命中。', {
      hit: false,
      hpBefore: 8,
      hpAfter: 8,
    }), 13),
    id: 'action-2',
    createdAt: 4,
  };
  const currentAttack = {
    ...createActionResultMessage(attackResult('最新攻击命中，造成 4 点伤害，HP 6→2。', {
      hit: true,
      hpBefore: 6,
      hpAfter: 2,
    }), 33),
    id: 'action-current',
    createdAt: 7,
  };
  const messages = [
    {
      id: 'opening',
      role: 'assistant',
      kind: 'dm-narration',
      content: '客运站里的人群下意识散开。',
      createdAt: 1,
      status: 'done',
      agentRunId: 1,
      modelTranscript: [{ role: 'tool', tool_call_id: 'old-tool', content: '旧工具中包含全部攻击事件。' }],
    },
    firstAttack,
    {
      id: 'legacy-dm',
      role: 'assistant',
      content: '孩子踉跄着退到长椅旁。',
      createdAt: 2,
      status: 'done',
      agentRunId: 4,
      modelTranscript: [{
        role: 'assistant',
        content: '',
        tool_calls: [{
          id: 'legacy-dm-call',
          type: 'function',
          function: {
            name: 'dm_speak',
            arguments: JSON.stringify({ content: '孩子踉跄着退到长椅旁。' }),
          },
        }],
      }],
    },
    {
      id: 'old-audit',
      role: 'assistant',
      content: '我已经完成了此前全部攻击事件的叙事化。',
      createdAt: 3,
      status: 'done',
      agentRunId: 2,
      modelTranscript: [{ role: 'assistant', content: '第一次攻击、第二次攻击的内部复盘。' }],
    },
    secondAttack,
    {
      id: 'npc-reply',
      role: 'assistant',
      kind: 'npc-speech',
      content: '你打够了吧？',
      createdAt: 5,
      status: 'done',
      agentRunId: 3,
      npcSpeech: { entityId: 'target', name: '流浪孩子小头领' },
    },
    {
      id: 'player-reply',
      role: 'user',
      content: '马大帅再次抡起木棍。',
      createdAt: 6,
      status: 'done',
    },
    currentAttack,
  ];
  const conversation = {
    id: 'conversation',
    title: '动作上下文测试',
    createdAt: 1,
    updatedAt: 7,
    contextMode: 'full-history',
    messages,
  };

  const contextEvents = buildCurrentActionContextEvents(conversation, messages, currentAttack.id);
  const actionEvents = contextEvents.filter((event) => event.type === 'action_result');
  const serialized = JSON.stringify(contextEvents);

  assert.equal(actionEvents.length, 1);
  assert.equal(actionEvents[0].current, true);
  assert.equal(actionEvents[0].eventId, 33);
  assert.equal(actionEvents[0].summary, currentAttack.content);
  assert.equal(contextEvents.some((event) => event.type === 'model_message' || event.type === 'agent_step'), false);
  assert.equal(serialized.includes('第一次攻击'), false);
  assert.equal(serialized.includes('第二次攻击'), false);
  assert.equal(serialized.includes('我已经完成了此前全部攻击事件'), false);
  assert.equal(serialized.includes('旧工具中包含全部攻击事件'), false);
  assert.ok(contextEvents.some((event) => (
    event.type === 'message'
    && event.role === 'assistant'
    && event.content === '客运站里的人群下意识散开。'
  )));
  assert.ok(contextEvents.some((event) => (
    event.type === 'message'
    && event.role === 'assistant'
    && event.content === '孩子踉跄着退到长椅旁。'
  )));
  assert.ok(contextEvents.some((event) => (
    event.type === 'message'
    && event.role === 'assistant'
    && event.content === '流浪孩子小头领：你打够了吧？'
  )));
  assert.ok(contextEvents.some((event) => (
    event.type === 'message'
    && event.role === 'user'
    && event.content === '马大帅再次抡起木棍。'
  )));
});

test('current action context keeps the configured summary but not covered action cards', () => {
  const coveredAttack = {
    ...createActionResultMessage(attackResult('摘要前的旧攻击。', {
      hit: false,
      hpBefore: 10,
      hpAfter: 10,
    }), 5),
    id: 'covered-action',
    createdAt: 1,
  };
  const currentAttack = {
    ...createActionResultMessage(attackResult('当前攻击未命中。', {
      hit: false,
      hpBefore: 10,
      hpAfter: 10,
    }), 6),
    id: 'current-action',
    createdAt: 3,
  };
  const messages = [
    coveredAttack,
    { id: 'summary-boundary', role: 'user', content: '此前剧情边界。', createdAt: 2, status: 'done' },
    currentAttack,
  ];
  const conversation = {
    id: 'summary-conversation',
    title: '摘要动作上下文测试',
    createdAt: 1,
    updatedAt: 3,
    contextMode: 'summary-only',
    contextSummary: {
      content: '此前攻击已经结算并叙事完毕。',
      compressedAt: 2,
      messageCount: 2,
      lastMessageId: 'summary-boundary',
    },
    messages,
  };

  const contextEvents = buildCurrentActionContextEvents(conversation, messages, currentAttack.id);

  assert.deepEqual(contextEvents.map((event) => event.type), ['summary', 'action_result']);
  assert.equal(contextEvents[1].eventId, 6);
  assert.equal(contextEvents[1].current, true);
  assert.equal(JSON.stringify(contextEvents).includes('摘要前的旧攻击'), false);
});
