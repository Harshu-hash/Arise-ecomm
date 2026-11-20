// Writes the default platform settings sections into MongoDB. Non-destructive: a section that
// already exists (saved by an admin) is left untouched. Usage: node scripts/seedPlatformSettings.mjs
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { SETTINGS_SECTIONS } from '../src/modules/admin/domain/constants/platformSettings.js';
import { PlatformSetting } from '../src/modules/admin/infrastructure/persistence/platformSetting.model.js';

await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
for (const { id, values } of SETTINGS_SECTIONS) {
  const res = await PlatformSetting.updateOne({ key: id }, { $setOnInsert: { key: id, values, version: 1, updatedByName: 'System' } }, { upsert: true });
  console.log(id.padEnd(20), res.upsertedCount ? 'created' : 'already exists');
}
console.log('total in DB:', await PlatformSetting.countDocuments());
await mongoose.disconnect();
