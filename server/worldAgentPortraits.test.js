import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const WORLD_DB_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'worldDb.js')).href;
const WORLD_AGENT_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'worldAgent.js')).href;

test('npc_speak normalizes current-scene speech and rejects off-scene NPCs', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(WORLD_AGENT_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    const angry = worldAgent.executeWorldTool('npc_speak', {
      npcEntityId: 'character_wandering_child',
      portraitState: 'angry',
      content: '立刻离开。',
    });
    const legacy = worldAgent.executeWorldTool('npc_speak', {
      npcEntityId: 'character_wandering_child',
      content: '旧调用仍然可用。',
    });
    const offScene = worldAgent.executeWorldTool('npc_speak', {
      npcEntityId: 'character_yufen',
      portraitState: 'neutral',
      content: '这句话不应该出现。',
    });
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ angry, legacy, offScene }));
  `);

  assert.equal(result.angry.ok, true);
  assert.equal(result.angry.portraitState, 'angry');
  assert.match(result.angry.sceneVisitId, /^visit_/);
  assert.equal(result.legacy.portraitState, 'neutral');
  assert.equal(result.legacy.sceneVisitId, result.angry.sceneVisitId);
  assert.equal(result.offScene.ok, false);
  assert.match(result.offScene.error, /不在当前场景/);
});

test('native assistant transcripts omit an empty tool_calls array', () => {
  const result = runIsolatedWorldScript(`
    const worldAgent = await import(${JSON.stringify(WORLD_AGENT_MODULE_URL)});
    const withoutTools = worldAgent.createNativeAssistantTranscriptMessage({
      role: 'assistant',
      content: '请改用发言工具。',
      tool_calls: [],
    });
    const withTools = worldAgent.createNativeAssistantTranscriptMessage({
      role: 'assistant',
      content: '',
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'dm_speak', arguments: '{}' } }],
    });
    console.log(JSON.stringify({ withoutTools, withTools }));
  `);

  assert.equal('tool_calls' in result.withoutTools, false);
  assert.equal(result.withTools.tool_calls.length, 1);
});

function runIsolatedWorldScript(script) {
  const cwd = mkdtempSync(join(tmpdir(), 'newchat-world-agent-portraits-'));
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
