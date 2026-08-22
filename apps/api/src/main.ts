import { createServer } from 'node:http';
import { createApp } from './app.js';

const app = createApp();

const server = createServer((request, response) => {
  void app.handleRequest(request, response);
});

server.listen(app.config.port, () => {
  console.log(`DevOS API listening on ${app.config.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`DevOS API received ${signal}, shutting down gracefully`);
  server.close();
  await app.close();
  console.log('DevOS API stopped');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
