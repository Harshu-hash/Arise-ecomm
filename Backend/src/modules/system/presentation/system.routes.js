import { Router } from 'express';
import { databaseStatus } from '../../../config/database.js';
import { redisStatus } from '../../../config/redis.js';
import { sendData } from '../../../shared/http/respond.js';

export function createSystemRouter() {
  const router = Router();

  router.get('/live', (_req, res) =>
    sendData(res, { status: 'ok', check: 'liveness', timestamp: new Date().toISOString() }),
  );

  router.get('/ready', async (_req, res) => {
    const checks = {
      mongo: databaseStatus(),
      redis: await redisStatus(),
    };
    const ready = Object.values(checks).every((check) => check.ready);
    return sendData(
      res,
      { status: ready ? 'ok' : 'degraded', check: 'readiness', checks, timestamp: new Date().toISOString() },
      { status: ready ? 200 : 503 },
    );
  });

  router.get('/health', (_req, res) =>
    sendData(res, { status: 'ok', service: 'arise-commerce-backend', timestamp: new Date().toISOString() }),
  );

  return router;
}

