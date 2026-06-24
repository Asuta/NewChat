import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const portFile = resolve(process.cwd(), '.newchat', 'server-port');
const timeoutMs = Number(process.env.NEWCHAT_PORT_WAIT_TIMEOUT_MS || 10000);
const startedAt = Date.now();
const deadline = Date.now() + timeoutMs;

while (Date.now() < deadline) {
  if (existsSync(portFile)) {
    const stats = statSync(portFile);
    if (stats.mtimeMs >= startedAt - 1000) {
      const port = Number(readFileSync(portFile, 'utf8').trim());
      if (Number.isInteger(port) && port > 0 && port < 65536) {
        process.exit(0);
      }
    }
  }

  await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
}

console.error(`Timed out waiting for NewChat server port file: ${portFile}`);
process.exit(1);
