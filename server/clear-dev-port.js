import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

rmSync(resolve(process.cwd(), '.newchat', 'server-port'), { force: true });
