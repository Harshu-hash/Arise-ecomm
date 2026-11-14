import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import multer from 'multer';
import { env } from '../../config/env.js';
import { TMP_DIR } from '../../infrastructure/storage/local.storage.js';
import { ValidationError } from '../errors/AppError.js';

// Streams the upload to tmp/ on disk (never into memory). Hard cap = the largest allowed type (video);
// the per-type limit is enforced afterwards in saveUpload, once the real file type is known.
const parser = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, done) => mkdir(TMP_DIR, { recursive: true }).then(() => done(null, TMP_DIR), done),
    filename: (_req, _file, done) => done(null, randomUUID()),
  }),
  limits: { fileSize: env.MAX_VIDEO_BYTES, files: 1, fields: 5, parts: 10 },
}).single('file');

export function uploadSingle(req, res, next) {
  parser(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return next(new ValidationError('File is too large.'));
    if (error instanceof multer.MulterError) return next(new ValidationError('Invalid upload request.'));
    return next(error);
  });
}

// Named-fields variant for forms that carry several documents alongside plain fields
// (e.g. seller registration: trade license + GST certificate + ID proof, pre-authentication).
export function uploadFields(fieldNames) {
  const fieldsParser = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, done) => mkdir(TMP_DIR, { recursive: true }).then(() => done(null, TMP_DIR), done),
      filename: (_req, _file, done) => done(null, randomUUID()),
    }),
    limits: { fileSize: env.MAX_UPLOAD_BYTES, files: fieldNames.length, fields: 30, parts: 40 },
  }).fields(fieldNames.map((name) => ({ name, maxCount: 1 })));

  return (req, res, next) => {
    fieldsParser(req, res, (error) => {
      if (!error) return next();
      if (error.code === 'LIMIT_FILE_SIZE') return next(new ValidationError('A file is too large.'));
      if (error instanceof multer.MulterError) return next(new ValidationError('Invalid upload request.'));
      return next(error);
    });
  };
}
