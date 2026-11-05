import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

export async function connectDatabase() {
  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: !env.isProduction,
    maxPoolSize: 50,
    minPoolSize: env.isProduction ? 5 : 0,
    serverSelectionTimeoutMS: 5_000,
  });
  logger.info('MongoDB connected');
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export function databaseStatus() {
  const state = mongoose.connection.readyState;
  return { ready: state === 1, state };
}

export async function withTransaction(work, options = {}) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session), {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
      ...options,
    });
  } finally {
    await session.endSession();
  }
}

