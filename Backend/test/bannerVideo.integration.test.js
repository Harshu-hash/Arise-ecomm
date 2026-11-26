// Real-MongoDB test: a hero banner is an image or a video, never both or neither. Needs TEST_MONGODB_URI.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import mongoose from 'mongoose';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DISABLE_INFRASTRUCTURE: 'true',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-bvideo-')),
});
process.on('exit', () => rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true }));

const uri = process.env.TEST_MONGODB_URI;
const opts = { skip: !uri && 'set TEST_MONGODB_URI to run' };
before(async () => { if (uri) await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, autoIndex: true }); });
after(async () => {
  if (uri) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('banner media: image xor video, video only on a hero, and the app feed carries the right url', opts, async () => {
  const { createBanner, updateBanner, listLiveBanners } = await import('../src/modules/admin/application/banner.service.js');
  const actor = { userId: 'admin-1' };
  const day = 86_400_000;
  const base = { name: 'B', kind: 'HERO', altText: 'alt', placements: ['HOME_HERO'], categoryIds: [], startsAt: new Date(), endsAt: new Date(Date.now() + 7 * day) };
  const none = { mobile_16_9: '', tile_1_1: '', web: '' };
  const pic = { mobile_16_9: 'http://x/p.png', tile_1_1: 'http://x/p.png', web: 'http://x/p.png' };

  await assert.rejects(createBanner({ ...base, images: none, videoUrl: '' }, actor), { code: 'VALIDATION_ERROR' }, 'neither');
  await assert.rejects(createBanner({ ...base, images: pic, videoUrl: 'http://x/v.mp4' }, actor), { code: 'VALIDATION_ERROR' }, 'both');
  await assert.rejects(createBanner({ ...base, kind: 'TILE', images: none, videoUrl: 'http://x/v.mp4' }, actor), { code: 'VALIDATION_ERROR' }, 'video tile');

  const video = await createBanner({ ...base, name: 'V', images: none, videoUrl: 'http://x/v.mp4' }, actor);
  const image = await createBanner({ ...base, name: 'I', images: pic, videoUrl: '' }, actor);
  const feed = await listLiveBanners('HOME_HERO');
  assert.deepEqual(feed.map((b) => [!!b.imageUrl, !!b.videoUrl]).sort(), [[false, true], [true, false]]);

  await assert.rejects(updateBanner(video.id, { images: pic }, actor), { code: 'VALIDATION_ERROR' }, 'adding an image to a video banner');
  const swapped = await updateBanner(video.id, { images: pic, videoUrl: '' }, actor);
  assert.equal(swapped.videoUrl, '');
  assert.equal(image.videoUrl, '');
});
