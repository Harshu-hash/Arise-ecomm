import { rm } from 'node:fs/promises';
import { Router } from 'express';
import { z } from 'zod';
import { PRIVATE_FOLDERS, UPLOAD_PURPOSES } from '../../../shared/constants/uploadPurposes.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { saveUpload, publicUrl, resolveKey } from '../../../infrastructure/storage/local.storage.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { sendCommand } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate } from '../../../shared/middleware/authenticate.js';
import { createRateLimiter } from '../../../shared/middleware/rateLimit.js';
import { uploadSingle } from '../../../shared/middleware/upload.js';
import { verifyFileToken } from '../../../shared/utils/signedUrl.js';

const bodySchema = z.object({ purpose: z.enum(Object.keys(UPLOAD_PURPOSES)) });
const privateParams = z.object({
  folder: z.enum(PRIVATE_FOLDERS),
  ownerId: z.string().regex(/^[\w-]{1,64}$/),
  file: z.string().regex(/^[0-9a-f-]{36}\.[a-z0-9]{3,4}$/),
});

// One upload surface mounted under /api/{customer,seller,admin}/v1/uploads; the purpose decides who may use it.
export function createUploadRouter() {
  const router = Router();

  router.post(
    '/',
    authenticate,
    createRateLimiter({ name: 'upload', windowMs: 60_000, limit: 30 }),
    uploadSingle,
    validate({ body: bodySchema }),
    async (req, res, next) => {
      try {
        const purpose = UPLOAD_PURPOSES[req.body.purpose];
        if (!req.file) throw new ValidationError('A file is required.', { file: ['Missing'] });
        if (!purpose.roles.includes(req.auth.role)) throw new ForbiddenError();

        // Owner folder comes from the verified token: sellers write under their sellerId, others under their userId.
        const ownerId = req.auth.sellerId ?? req.auth.userId;
        const saved = await saveUpload({
          file: req.file,
          allowedKinds: purpose.kinds,
          visibility: purpose.visibility,
          scope: `${purpose.folder}/${ownerId}`,
        });
        const data = { key: saved.key, mime: saved.mime, sizeBytes: saved.sizeBytes };
        if (saved.key.startsWith('public/')) data.url = publicUrl(saved.key);
        return sendCommand(res, data, { status: 201 });
      } catch (error) {
        if (req.file) await rm(req.file.path, { force: true }); // no-op if already moved into place
        return next(error);
      }
    },
  );

  // Private files (KYC, return proofs): only the owner or an admin gets the bytes; anyone
  // else sees a 404. Two ways in: the usual Bearer token (XHR/fetch), or a short-lived
  // signed `?token=` for plain <img src>/<a href> tags that cannot carry a header.
  router.get('/private/:folder/:ownerId/:file', validate({ params: privateParams }), (req, res, next) => {
    const { folder, ownerId, file } = req.params;
    const key = `private/${folder}/${ownerId}/${file}`;
    const serve = () =>
      res.sendFile(
        resolveKey(key),
        { dotfiles: 'deny', headers: { 'Cache-Control': 'private, no-store' } },
        (error) => error && next(new NotFoundError()),
      );

    if (req.query.token) {
      return verifyFileToken(key, req.query.token) ? serve() : next(new NotFoundError());
    }
    return authenticate(req, res, (error) => {
      if (error) return next(new NotFoundError());
      const isOwner = ownerId === (req.auth.sellerId ?? req.auth.userId);
      if (!isOwner && req.auth.role !== ROLES.ADMIN) return next(new NotFoundError());
      return serve();
    });
  });

  return router;
}
