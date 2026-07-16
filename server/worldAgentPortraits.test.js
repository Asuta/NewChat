import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const WORLD_DB_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'worldDb.js')).href;
const WORLD_AGENT_MODULE_URL = pathToFileURL(join(process.cwd(), 'server', 'worldAgent.js')).href;

test('npc_speak returns a normalized portrait state with its visible speech', () => {
  const result = runIsolatedWorldScript(`
    const worldDb = await import(${JSON.stringify(WORLD_DB_MODULE_URL)});
    const worldAgent = await import(${JSON.stringify(WORLD_AGENT_MODULE_URL)});
    worldDb.migrateWorldDb();
    worldDb.seedWorldIfEmpty();
    const angry = worldAgent.executeWorldTool('npc_speak', {
      npcEntityId: 'character_elena',
      portraitState: 'angry',
      content: '立刻离开。',
    });
    const legacy = worldAgent.executeWorldTool('npc_speak', {
      npcEntityId: 'character_elena',
      content: '旧调用仍然可用。',
    });
    worldDb.closeWorldDb();
    console.log(JSON.stringify({ angry, legacy }));
  `);

  assert.equal(result.angry.ok, true);
  assert.equal(result.angry.portraitState, 'angry');
  assert.match(result.angry.sceneVisitId, /^visit_/);
  assert.equal(result.legacy.portraitState, 'neutral');
  assert.equal(result.legacy.sceneVisitId, result.angry.sceneVisitId);
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
