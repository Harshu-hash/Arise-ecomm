// Production runs with autoIndex off, so build every model's indexes explicitly.
// Run after first deploy and after schema changes:
//   docker compose -f docker-compose.prod.yml run --rm api node scripts/syncIndexes.mjs
// Exits non-zero if existing data violates a unique index; fix the duplicates and re-run.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : [],
  );

for (const file of walk(path.resolve('src'))) {
  if (readFileSync(file, 'utf8').includes('mongoose.model(')) await import(pathToFileURL(file).href);
}

await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
const names = mongoose.modelNames();
let failed = 0;
for (const name of names) {
  try {
    await mongoose.model(name).syncIndexes();
  } catch (error) {
    failed += 1;
    console.error(`${name}: ${error.message}`);
  }
}
console.log(`Synced indexes for ${names.length - failed}/${names.length} models`);
await mongoose.disconnect();
process.exit(failed ? 1 : 0);
