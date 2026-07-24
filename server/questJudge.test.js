import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const WORLD_DB_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'worldDb.js')).href;
const QUEST_JUDGE_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'questJudge.js')).href;

test('大模型可以一次判定全部活动任务，并持久化完成与后续解锁', () => {
  const result = runIsolatedQuestScript(`
    process.env.LLM_MOCK = '0';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_MODEL = 'deepseek-v4-flash';
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const questJudge = await import(${JSON.stringify(QUEST_JUDGE_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    const legacyMainQuest = worldDb.getComponent('quest_main', 'quest');
    worldDb.upsertComponent('quest_main', 'quest', {
      ...legacyMainQuest,
      objectives: legacyMainQuest.objectives.map(({ questId: _questId, ...objective }) => objective),
    });
    worldDb.ensurePlayableCharacterStats();
    const playerLine = worldDb.addConversation('user', 'player', '马大帅', '我终于找到范德彪了。');
    const npcLine = worldDb.addConversation('npc', 'character_fan_debiao', '范德彪', '姐夫，我就是德彪，可算见着你了！');
    const speechEvent = worldDb.addEvent('npc.spoke', 'character_fan_debiao', 'player', {
      summary: '范德彪与马大帅当面相认。',
    });
    let requestCount = 0;
    let requestSummary = null;
    globalThis.fetch = async (_url, init) => {
      requestCount += 1;
      const body = JSON.parse(init.body);
      const payload = JSON.parse(body.messages.at(-1).content);
      requestSummary = {
        toolChoice: body.tool_choice?.function?.name,
        thinking: body.thinking?.type,
        candidateQuestIds: payload.candidateQuests.map((quest) => quest.id).sort(),
      };
      const judgments = payload.candidateQuests.map((quest) => quest.id === 'quest_find_debiao'
        ? {
            questId: quest.id,
            decision: 'completed',
            progressSummary: '马大帅已经和范德彪当面相认。',
            reason: '范德彪直接称呼马大帅为姐夫并确认自己身份。',
            evidenceConversationIds: [npcLine.id],
            evidenceEventIds: [speechEvent.id],
          }
        : {
            questId: quest.id,
            decision: 'unchanged',
            progressSummary: quest.previousProgressSummary,
            reason: '本轮没有解决吃饭和过夜问题。',
            evidenceConversationIds: [],
            evidenceEventIds: [],
          });
      return new Response(JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'quest-judgment',
              type: 'function',
              function: {
                name: 'submit_quest_judgment',
                arguments: JSON.stringify({ judgments }),
              },
            }],
          },
        }],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const judgment = await questJudge.judgeQuestsAfterTurn();
    const findDebiao = worldDb.getComponent('quest_find_debiao', 'quest');
    const findXiaocui = worldDb.getComponent('quest_find_xiaocui', 'quest');
    const mainQuest = worldDb.getComponent('quest_main', 'quest');
    const questLog = worldDb.getQuestLog();
    const checkpoint = {
      conversation: worldDb.getMeta('questJudge.conversationCursor', ''),
      event: worldDb.getMeta('questJudge.eventCursor', ''),
    };
    const followUp = await questJudge.judgeQuestsAfterTurn();
    const idle = await questJudge.judgeQuestsAfterTurn();
    worldDb.closeWorldDb();
    console.log(JSON.stringify({
      judgment,
      findDebiao,
      findXiaocui,
      mainQuest,
      questLog,
      checkpoint,
      followUp,
      idle,
      requestCount,
      requestSummary,
      evidenceIds: { playerLine: playerLine.id, npcLine: npcLine.id, speechEvent: speechEvent.id },
    }));
  `);

  assert.equal(result.judgment.status, 'judged');
  assert.equal(result.findDebiao.status, 'completed');
  assert.equal(result.findDebiao.progressSummary, '马大帅已经和范德彪当面相认。');
  assert.equal(result.findXiaocui.status, 'active');
  assert.equal(result.findXiaocui.phaseStatus, 'available');
  assert.equal(
    result.mainQuest.objectives.find((objective) => objective.questId === 'quest_find_debiao')?.status,
    'completed',
  );
  assert.equal(
    result.mainQuest.objectives.find((objective) => objective.questId === 'quest_find_xiaocui')?.status,
    'active',
  );
  assert.equal(result.questLog.activeCount, 2);
  assert.equal(result.questLog.completedCount, 1);
  assert.match(result.questLog.latestUpdate.payload.summary, /寻找范德彪/);
  assert.match(result.questLog.latestUpdate.payload.summary, /父女见面/);
  assert.equal(result.checkpoint.conversation, String(result.evidenceIds.npcLine));
  assert.equal(result.checkpoint.event, String(result.evidenceIds.speechEvent));
  assert.equal(result.followUp.status, 'advanced');
  assert.equal(result.idle.status, 'idle');
  assert.equal(result.requestCount, 1);
  assert.equal(result.requestSummary.toolChoice, 'submit_quest_judgment');
  assert.equal(result.requestSummary.thinking, 'disabled');
  assert.deepEqual(result.requestSummary.candidateQuestIds, ['quest_find_debiao', 'quest_survive_city']);
});

test('任务判定模型失败时不推进证据游标，下一回合仍可重试', () => {
  const result = runIsolatedQuestScript(`
    process.env.LLM_MOCK = '0';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_MODEL = 'deepseek-v4-flash';
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const questJudge = await import(${JSON.stringify(QUEST_JUDGE_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    worldDb.addConversation('user', 'player', '马大帅', '我去找点吃的。');
    const before = {
      conversation: worldDb.getMeta('questJudge.conversationCursor', ''),
      event: worldDb.getMeta('questJudge.eventCursor', ''),
    };
    globalThis.fetch = async () => new Response('upstream failed', { status: 503 });
    let error = '';
    try {
      await questJudge.judgeQuestsAfterTurn();
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const after = {
      conversation: worldDb.getMeta('questJudge.conversationCursor', ''),
      event: worldDb.getMeta('questJudge.eventCursor', ''),
    };
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ before, after, error }));
  `);

  assert.match(result.error, /503/);
  assert.deepEqual(result.after, result.before);
});

function runIsolatedQuestScript(script) {
  const cwd = mkdtempSync(join(tmpdir(), 'newchat-quest-judge-'));
  try {
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd,
      encoding: 'utf8',
    });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    return JSON.parse(child.stdout.trim().split(/\r?\n/).at(-1) || 'null');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
