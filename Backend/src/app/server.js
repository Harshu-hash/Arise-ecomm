import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { connectRedis, disconnectRedis } from '../config/redis.js';

const app = createApp();
const server = createServer(app);
const io = new SocketServer(server, {
  cors: { origin: env.corsOrigins, credentials: true },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  socket.on('disconnect', () => undefined);
});

async function start() {
  if (!env.DISABLE_INFRASTRUCTURE) {
    await Promise.all([connectDatabase(), connectRedis()]);
  }

  server.listen(env.PORT, env.HOST, () => {
    logger.info({ host: env.HOST, port: env.PORT }, 'HTTP server listening');
  });
}

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, 'Graceful shutdown started');

  const forceExit = setTimeout(() => {
    logger.fatal('Graceful shutdown timed out');
    process.exit(1);
  }, env.SHUTDOWN_GRACE_MS).unref();

  io.close();
  await new Promise((resolve) => server.close(resolve));
  if (!env.DISABLE_INFRASTRUCTURE) {
    await Promise.allSettled([disconnectDatabase(), disconnectRedis()]);
  }
  clearTimeout(forceExit);
  logger.info('Graceful shutdown complete');
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => shutdown(signal).then(() => process.exit(0)));
}

start().catch((error) => {
  logger.fatal({ err: error }, 'Application startup failed');
  process.exit(1);
});

