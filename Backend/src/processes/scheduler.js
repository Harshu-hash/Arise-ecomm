import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../config/logger.js';
import { bullmqEnabled } from '../config/redis.js';
import { createMaintenanceQueue, registerMaintenanceSchedules } from '../infrastructure/queue/maintenance.queue.js';

if (!bullmqEnabled) {
  logger.warn('BullMQ/Redis disabled; this process has nothing to run');
  process.exit(0);
}

const { queue, connection } = createMaintenanceQueue();

async function start() {
  await connectDatabase();
  // Only one scheduler replica should run. Module-owned jobs are registered here as modules are implemented.
  await registerMaintenanceSchedules(queue);
  logger.info('Scheduler started');
}

async function stop(signal) {
  logger.info({ signal }, 'Stopping scheduler process');
  await queue.close();
  await connection.quit();
  await disconnectDatabase();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => stop(signal).then(() => process.exit(0)));
}

start().catch((error) => {
  logger.fatal({ err: error }, 'Scheduler process failed');
  process.exit(1);
});
