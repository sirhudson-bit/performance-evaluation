import { createApp } from './app.js';
import { config } from './config.js';
import { db } from './db.js';
import './modules/handlers.js'; // registers job handlers

const app = createApp();

// Bind address is configurable: production keeps the API on loopback (only the
// Next server proxies /api/v1 to it), while Docker sets API_HOST=0.0.0.0 so the
// web container can reach it over the compose network.
const host = process.env.API_HOST?.trim() || undefined;

const onListening = (): void => {
  console.info(`[api] listening on http://${host ?? '0.0.0.0'}:${config.API_PORT} (${config.NODE_ENV})`);
};

const server = host
  ? app.listen(config.API_PORT, host, onListening)
  : app.listen(config.API_PORT, onListening);

async function shutdown(signal: string): Promise<void> {
  console.info(`[api] ${signal} received, shutting down…`);
  server.close(() => {
    void db.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 8000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
