import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../config/logger.js';
import { createDomainEventsQueue } from '../infrastructure/queue/domainEvents.queue.js';

const { queue, connection } = createDomainEventsQueue();

async function start() {
  await connectDatabase();
  // Repeatable reconciliation and cleanup jobs are registered here as their
  // owning modules are implemented. Only one scheduler replica should run.
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

