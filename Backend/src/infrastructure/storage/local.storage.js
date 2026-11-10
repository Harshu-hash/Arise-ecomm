import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { FILE_KIND, VISIBILITY } from '../../shared/constants/uploadPurposes.js';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError.js';

// ObjectStorage on local disk. Layout under UPLOAD_DIR (dev ./uploads, live /var/www/uploads):
//   public/<scope>/...   served openly at /uploads/<scope>/... (nginx alias in production)
//   private/<scope>/...  NEVER served statically; only through the authenticated download route
//   tmp/                 multer landing zone (same filesystem, so the final move is an atomic rename)
export const UPLOAD_ROOT = path.resolve(env.UPLOAD_DIR);
export const PUBLIC_DIR = path.join(UPLOAD_ROOT, 'public');
export const PRIVATE_DIR = path.join(UPLOAD_ROOT, 'private');
export const TMP_DIR = path.join(UPLOAD_ROOT, 'tmp');

// The client's filename and Content-Type are never trusted: the type comes from the file's magic bytes.
const text = (head, from, to) => head.toString('latin1', from, to);
const SIGNATURES = [
  { mime: 'image/jpeg', ext: 'jpg', kind: FILE_KIND.IMAGE, test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', kind: FILE_KIND.IMAGE, test: (b) => b[0] === 0x89 && text(b, 1, 4) === 'PNG' },
  { mime: 'image/webp', ext: 'webp', kind: FILE_KIND.IMAGE, test: (b) => text(b, 0, 4) === 'RIFF' && text(b, 8, 12) === 'WEBP' },
  { mime: 'application/pdf', ext: 'pdf', kind: FILE_KIND.DOCUMENT, test: (b) => text(b, 0, 5) === '%PDF-' },
  { mime: 'video/mp4', ext: 'mp4', kind: FILE_KIND.VIDEO, test: (b) => text(b, 4, 8) === 'ftyp' },
  { mime: 'video/webm', ext: 'webm', kind: FILE_KIND.VIDEO, test: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
];
const MAX_BYTES = {
  [FILE_KIND.IMAGE]: env.MAX_UPLOAD_BYTES,
  [FILE_KIND.DOCUMENT]: env.MAX_UPLOAD_BYTES,
  [FILE_KIND.VIDEO]: env.MAX_VIDEO_BYTES,
};

async function readHead(filePath) {
  const handle = await open(filePath, 'r');
  try {
    const head = Buffer.alloc(16);
    await handle.read(head, 0, 16, 0);
    return head;
  } finally {
    await handle.close();
  }
}

// `scope` is a trusted server-built path (e.g. "products/<sellerId>"), never raw user input.
// Moves the multer temp file to its final home, or deletes it and throws.
export async function saveUpload({ file, allowedKinds, visibility, scope }) {
  try {
    const head = await readHead(file.path);
    const type = SIGNATURES.find((signature) => signature.test(head));
    if (!type || !allowedKinds.includes(type.kind)) {
      throw new ValidationError('This file type is not allowed.', { file: [`Allowed: ${allowedKinds.join(', ')}`] });
    }
    if (file.size > MAX_BYTES[type.kind]) {
      throw new ValidationError('File is too large.', { file: [`Max ${Math.floor(MAX_BYTES[type.kind] / 1024 / 1024)} MB for ${type.kind}`] });
    }

    const directory = path.join(visibility === VISIBILITY.PUBLIC ? PUBLIC_DIR : PRIVATE_DIR, ...scope.split('/'));
    const name = `${randomUUID()}.${type.ext}`; // never the client's filename
    await mkdir(directory, { recursive: true });
    await rename(file.path, path.join(directory, name));
    return { key: `${visibility}/${scope}/${name}`, mime: type.mime, sizeBytes: file.size, kind: type.kind };
  } catch (error) {
    await rm(file.path, { force: true });
    throw error;
  }
}

// Maps a stored key to its absolute path; rejects anything that escapes UPLOAD_ROOT (path traversal).
export function resolveKey(key) {
  const full = path.resolve(UPLOAD_ROOT, key);
  if (!full.startsWith(UPLOAD_ROOT + path.sep)) throw new NotFoundError();
  return full;
}

export const publicUrl = (key) => `${env.PUBLIC_ORIGIN}/uploads/${key.replace(/^public\//, '')}`;

export const deleteFile = (key) => rm(resolveKey(key), { force: true });
