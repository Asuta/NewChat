import { defineConfig, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';

const DEFAULT_API_PORT = 8787;
const DEV_PORT_FILE = resolve(process.cwd(), '.newchat', 'server-port');

export default defineConfig({
  plugins: [react(), stageUrlLogger()],
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

function stageUrlLogger() {
  return {
    name: 'newchat-stage-url-logger',
    configureServer(server: ViteDevServer) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address();
        if (!address || typeof address === 'string') return;
        const host = formatHost(address);
        server.config.logger.info(`\n  Stage UI: http://${host}:${address.port}/stage\n`);
      });
    },
  };
}

function formatHost(address: AddressInfo) {
  if (!address.address || address.address === '::' || address.address === '0.0.0.0') {
    return '127.0.0.1';
  }
  if (address.family === 'IPv6') {
    return `[${address.address}]`;
  }
  return address.address;
}

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
