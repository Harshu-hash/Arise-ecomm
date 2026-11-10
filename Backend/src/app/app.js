import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { PUBLIC_DIR } from '../infrastructure/storage/local.storage.js';
import { httpMetrics } from '../infrastructure/observability/metrics.js';
import { errorHandler } from '../shared/http/errorHandler.js';
import { notFoundHandler } from '../shared/http/notFound.js';
import { requestContextMiddleware } from '../shared/http/requestContext.js';
import { globalRateLimiter } from '../shared/middleware/rateLimit.js';
import { sanitizeInput } from '../shared/middleware/sanitize.js';
import { createRoutes } from './routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
      customProps: (req) => ({ requestId: req.id }),
    }),
  );
  app.use(requestContextMiddleware);
  app.use(httpMetrics);
  app.use(
    helmet({
      hsts: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      exposedHeaders: ['x-request-id'],
    }),
  );
  app.use(compression());

  // Public uploads (product images etc.). In production nginx serves this same folder directly; this is the fallback.
  app.use(
    '/uploads',
    express.static(PUBLIC_DIR, {
      index: false,
      dotfiles: 'deny',
      maxAge: '30d',
      immutable: true, // file names are random UUIDs, so a path never changes content
      setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'), // frontend is on another origin
    }),
  );

  // Per-IP limit before body parsing, on everything except provider webhooks (gated by signature instead).
  const limiter = globalRateLimiter();
  app.use((req, res, next) => (req.path.startsWith('/webhooks/') ? next() : limiter(req, res, next)));

  app.use(
    express.json({
      limit: env.REQUEST_BODY_LIMIT,
      // Webhook signatures are computed over the exact raw bytes.
      verify: (req, _res, buf) => {
        if (req.originalUrl.startsWith('/webhooks/')) req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: env.REQUEST_BODY_LIMIT }));
  app.use(sanitizeInput);

  app.use(createRoutes());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

