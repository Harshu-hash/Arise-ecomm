import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { env } from '../../../config/env.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { deleteFile, publicUrl, saveUpload, TMP_DIR } from '../../../infrastructure/storage/local.storage.js';
import { signFileToken } from '../../../shared/utils/signedUrl.js';
import { isPublic, MEDIA_KINDS, resolveMediaKind } from '../domain/services/mediaRules.js';
import { Media } from '../infrastructure/persistence/media.model.js';

const id = (value) => (value ? String(value) : null);

/** A stored key's servable URL — public and permanent, or private and signed, by its kind's own rule. */
export function urlForKey(key, kind) {
  if (!key) return null;
  const rule = MEDIA_KINDS[kind];
  if (rule && isPublic(rule)) return publicUrl(key);
  // The private download route (system/upload.routes.js) is identical and ownerId-gated
  // under every audience prefix, so any one of them resolves the same file.
  const [, folder, ownerId, file] = key.split('/');
  return `${env.PUBLIC_ORIGIN}/api/seller/v1/uploads/private/${folder}/${ownerId}/${file}?token=${signFileToken(key)}`;
}

const previewUrlFor = (row) => urlForKey(row.key, row.kind);

export function serializeMedia(row) {
  return {
    id: id(row._id),
    mediaId: id(row._id),
    kind: row.kind,
    status: row.status,
    previewUrl: previewUrlFor(row),
    fileName: row.fileName,
    mime: row.mime,
    sizeBytes: row.sizeBytes,
    width: row.width ?? null,
    height: row.height ?? null,
    crop: row.crop ?? { aspect: 'original' },
    processingError: row.processingError ?? null,
    version: row.version,
  };
}

async function ownedMedia(mediaId, ownerId) {
  const media = await Media.findOne({ _id: mediaId, ownerId }).lean();
  if (!media) throw new NotFoundError('That file no longer exists.');
  return media;
}

/** Step 1: register the upload and hand back where its bytes should go. */
export async function presignUpload({ ownerId, role, kind, fileName, mimeType, sizeBytes }) {
  const rule = resolveMediaKind(kind, role);
  if (!rule) throw new ValidationError('Unsupported upload kind.', { kind: ['Unsupported upload kind.'] });
  if (sizeBytes > rule.maxBytes) {
    throw new ValidationError('File is too large.', { sizeBytes: [`Max ${Math.floor(rule.maxBytes / 1024 / 1024)} MB.`] });
  }
  const media = await new Media({ ownerId, kind, fileName, mime: mimeType, sizeBytes, status: 'PENDING' }).save();
  return { uploadId: id(media._id), mediaId: id(media._id), uploadUrl: `/media/uploads/${media._id}/bytes` };
}

/**
 * Step 2: the file's actual bytes (a direct PUT, not multipart — this is a local-disk
 * stand-in for a real presigned object-store URL; the client-side contract is identical
 * either way, so swapping in S3 later needs no UI change).
 */
export async function writeUploadBytes({ uploadId, ownerId, role, buffer }) {
  const media = await ownedMedia(uploadId, ownerId);
  if (media.status !== 'PENDING') throw new ValidationError('This upload was already completed or cancelled.');
  const rule = resolveMediaKind(media.kind, role);
  if (!rule) throw new ForbiddenError();

  await mkdir(TMP_DIR, { recursive: true });
  const tmpPath = `${TMP_DIR}/${randomUUID()}`;
  await writeFile(tmpPath, buffer);

  let saved;
  try {
    saved = await saveUpload({
      file: { path: tmpPath, size: buffer.length },
      allowedKinds: rule.expect ? [rule.expect] : rule.purpose.kinds,
      visibility: rule.purpose.visibility,
      scope: `${rule.purpose.folder}/${ownerId}`,
    });
  } catch (error) {
    await Media.updateOne({ _id: media._id }, { $set: { status: 'FAILED', processingError: error.message } });
    throw error;
  }

  const updated = await Media.findOneAndUpdate(
    { _id: media._id },
    { $set: { status: 'READY', key: saved.key, mime: saved.mime, sizeBytes: saved.sizeBytes }, $inc: { version: 1 } },
    { new: true },
  ).lean();
  return serializeMedia(updated);
}

/** Step 3: the widget's confirmation call — the file is already durable by now. */
export async function completeUpload({ uploadId, ownerId, width, height }) {
  const media = await ownedMedia(uploadId, ownerId);
  if (media.status === 'PENDING') throw new ValidationError('Upload its bytes before completing.');
  const patch = {};
  if (width !== undefined) patch.width = width;
  if (height !== undefined) patch.height = height;
  const updated = Object.keys(patch).length
    ? await Media.findOneAndUpdate({ _id: media._id }, { $set: patch }, { new: true }).lean()
    : media;
  return serializeMedia(updated);
}

export async function abortUpload({ uploadId, ownerId }) {
  const media = await Media.findOneAndDelete({ _id: uploadId, ownerId }).lean();
  if (media?.key) await deleteFile(media.key).catch(() => undefined);
  return { ok: true };
}

export async function getMediaForOwner({ mediaId, ownerId }) {
  return serializeMedia(await ownedMedia(mediaId, ownerId));
}

export async function updateMediaCrop({ mediaId, ownerId, aspect }) {
  const media = await ownedMedia(mediaId, ownerId);
  const updated = await Media.findOneAndUpdate(
    { _id: media._id },
    { $set: { 'crop.aspect': aspect }, $inc: { version: 1 } },
    { new: true },
  ).lean();
  return serializeMedia(updated);
}

export async function removeMedia({ mediaId, ownerId }) {
  const media = await Media.findOneAndDelete({ _id: mediaId, ownerId }).lean();
  if (!media) throw new NotFoundError('That file no longer exists.');
  if (media.key) await deleteFile(media.key).catch(() => undefined);
  return { ok: true };
}

/**
 * For another module (e.g. product listings) turning the media IDs a form
 * collected into their durable storage keys. Only READY files this exact
 * owner uploaded, of one of the expected kinds, resolve — anything else comes
 * back in `missing` so the caller can reject the request cleanly.
 */
export async function resolveMediaKeys(mediaIds, { ownerId, kinds }) {
  const requested = mediaIds ?? [];
  if (!requested.length) return { keys: [], missing: [] };
  const uniqueIds = [...new Set(requested.map(String))];
  const rows = await Media.find(
    { _id: { $in: uniqueIds }, ownerId, status: 'READY', kind: { $in: kinds } },
    'key',
  ).lean();
  const keyById = new Map(rows.map((row) => [String(row._id), row.key]));
  const keys = [];
  const missing = [];
  for (const mediaId of requested) {
    const key = keyById.get(String(mediaId));
    if (key) keys.push(key);
    else missing.push(mediaId);
  }
  return { keys, missing };
}
