import { Router, raw } from 'express';
import { z } from 'zod';
import { env } from '../../../config/env.js';
import { ValidationError } from '../../../shared/errors/AppError.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate } from '../../../shared/middleware/authenticate.js';
import { idempotent } from '../../../shared/middleware/idempotency.js';
import { createRateLimiter } from '../../../shared/middleware/rateLimit.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { CROP_ASPECTS } from '../domain/services/mediaRules.js';
import {
  abortUpload,
  completeUpload,
  getMediaForOwner,
  presignUpload,
  removeMedia,
  updateMediaCrop,
  writeUploadBytes,
} from '../application/media.service.js';

const dimension = z.number().int().positive().nullable().optional();
const presignSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  sizeBytes: z.number().int().positive(),
  kind: z.string().min(1).max(64),
  width: dimension,
  height: dimension,
}).strict();
const completeSchema = z.object({ width: dimension, height: dimension }).strict();
const updateSchema = z.object({ crop: z.object({ aspect: z.enum(CROP_ASPECTS) }) }).strict();
const uploadIdParams = z.object({ uploadId: objectIdSchema });
const mediaIdParams = z.object({ mediaId: objectIdSchema });

const ownerOf = (req) => req.auth.sellerId ?? req.auth.userId;

// The seller "Add product" form's media widgets (MediaWorkflowUpload) talk to this
// contract: presign -> raw PUT of the bytes -> complete -> get/update/remove. It stands
// in for a real presigned object-store URL while storage is local disk; the client never
// needs to know the difference.
export function createMediaRouter() {
  const router = Router();
  router.use(authenticate);

  router.post(
    '/uploads',
    createRateLimiter({ name: 'media-presign', windowMs: 60_000, limit: 30 }),
    validate({ body: presignSchema }),
    idempotent(),
    async (req, res, next) => {
      try {
        const data = await presignUpload({ ownerId: ownerOf(req), role: req.auth.role, ...req.body });
        return sendCommand(res, data, { status: 201 });
      } catch (error) {
        return next(error);
      }
    },
  );

  // Raw body, not multipart: the client PUTs the file's bytes directly as the request body.
  router.put(
    '/uploads/:uploadId/bytes',
    validate({ params: uploadIdParams }),
    raw({ type: () => true, limit: env.MAX_VIDEO_BYTES }),
    async (req, res, next) => {
      try {
        if (!req.body?.length) throw new ValidationError('A file body is required.');
        const data = await writeUploadBytes({
          uploadId: req.params.uploadId,
          ownerId: ownerOf(req),
          role: req.auth.role,
          buffer: req.body,
        });
        return sendCommand(res, data);
      } catch (error) {
        return next(error);
      }
    },
  );

  router.post('/uploads/:uploadId/complete', validate({ params: uploadIdParams, body: completeSchema }), async (req, res, next) => {
    try {
      const data = await completeUpload({ uploadId: req.params.uploadId, ownerId: ownerOf(req), ...req.body });
      return sendCommand(res, data);
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/uploads/:uploadId', validate({ params: uploadIdParams }), async (req, res, next) => {
    try {
      return sendCommand(res, await abortUpload({ uploadId: req.params.uploadId, ownerId: ownerOf(req) }));
    } catch (error) {
      return next(error);
    }
  });

  router.get('/:mediaId', validate({ params: mediaIdParams }), async (req, res, next) => {
    try {
      return sendData(res, await getMediaForOwner({ mediaId: req.params.mediaId, ownerId: ownerOf(req) }));
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/:mediaId', validate({ params: mediaIdParams, body: updateSchema }), async (req, res, next) => {
    try {
      const data = await updateMediaCrop({ mediaId: req.params.mediaId, ownerId: ownerOf(req), aspect: req.body.crop.aspect });
      return sendCommand(res, data);
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/:mediaId', validate({ params: mediaIdParams }), async (req, res, next) => {
    try {
      return sendCommand(res, await removeMedia({ mediaId: req.params.mediaId, ownerId: ownerOf(req) }));
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
