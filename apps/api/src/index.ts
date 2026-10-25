import { createApp } from './app.js';
import { config } from './config.js';
import { db } from './db.js';
import './modules/handlers.js'; // registers job handlers

const app = createApp();

const server = app.listen(config.API_PORT, () => {
  console.info(`[api] listening on http://127.0.0.1:${config.API_PORT} (${config.NODE_ENV})`);
});

async function shutdown(signal: string): Promise<void> {
  console.info(`[api] ${signal} received, shutting down…`);
  server.close(() => {
    void db.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 8000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
