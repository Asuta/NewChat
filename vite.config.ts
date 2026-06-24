import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_API_PORT = 8787;
const DEV_PORT_FILE = resolve(process.cwd(), '.newchat', 'server-port');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${getApiPort()}`,
        changeOrigin: true,
      },
    },
  },
});

function getApiPort() {
  if (!existsSync(DEV_PORT_FILE)) {
    return DEFAULT_API_PORT;
  }

  const port = Number(readFileSync(DEV_PORT_FILE, 'utf8').trim());
  if (Number.isInteger(port) && port > 0 && port < 65536) {
    return port;
  }

  return DEFAULT_API_PORT;
}
