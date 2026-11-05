import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../config/logger.js';
import { createOutboxDispatcher } from '../infrastructure/events/outboxDispatcher.js';

const dispatcher = createOutboxDispatcher();

async function start() {
  await connectDatabase();
  await dispatcher.start();
}

async function stop(signal) {
  logger.info({ signal }, 'Stopping outbox process');
  await dispatcher.close();
  await disconnectDatabase();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => stop(signal).then(() => process.exit(0)));
}

start().catch((error) => {
  logger.fatal({ err: error }, 'Outbox process failed');
  process.exit(1);
});

