import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { connectRedis, disconnectRedis } from '../config/redis.js';
import { seedRoles } from '../modules/identity/infrastructure/persistence/role.model.js';
import { closeMailer } from '../infrastructure/external/notification/mailer.js';
import { closeMetrics } from '../infrastructure/observability/metrics.js';
import { closeNotificationQueue } from '../infrastructure/queue/notification.queue.js';
import { closeWebhookQueue } from '../infrastructure/queue/webhook.queue.js';
import { closeSocketServer, createSocketServer } from '../infrastructure/realtime/socket.js';

const app = createApp();
const server = createServer(app);
createSocketServer(server);

async function start() {
  if (!env.DISABLE_INFRASTRUCTURE) {
    await Promise.all([connectDatabase(), connectRedis()]);
    await seedRoles();
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

  await closeSocketServer(); // Socket.IO close also stops the HTTP server from accepting connections
  await new Promise((resolve) => server.close(resolve));
  await Promise.allSettled([closeNotificationQueue(), closeWebhookQueue(), closeMetrics(), closeMailer()]);
  if (!env.DISABLE_INFRASTRUCTURE) {
    await Promise.allSettled([disconnectDatabase(), disconnectRedis()]);
  }
  clearTimeout(forceExit);
  logger.info('Graceful shutdown complete');
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => shutdown(signal).then(() => process.exit(0)));
}

process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Unhandled promise rejection'));

start().catch((error) => {
  logger.fatal({ err: error }, 'Application startup failed');
  process.exit(1);
});
