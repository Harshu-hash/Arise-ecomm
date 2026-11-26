// Real-MongoDB test of referral fraud signals, the admin history and the invite landing page. Needs TEST_MONGODB_URI (replica set).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
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
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-fraud-')),
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

test('referral: two accounts on one phone are held for review, shown in the history, and the invite page renders', opts, async (t) => {
  const { User } = await import('../src/modules/identity/public/index.js');
  const { updateSettingsSection } = await import('../src/modules/admin/public/index.js');
  const { getOrCreateCode, attachReferral, qualifyOnDelivered, getCustomerReferrals, decideReferral } = await import('../src/modules/referral/application/referral.service.js');
  const { Referral } = await import('../src/modules/referral/infrastructure/persistence/referral.models.js');
  const { Device } = await import('../src/modules/notification/infrastructure/persistence/device.model.js');
  const { getBalance } = await import('../src/modules/wallet/public/index.js');
  const { createApp } = await import('../src/app/app.js');
  const actor = { userId: 'admin-1', role: 'ADMIN' };
  await updateSettingsSection('referral', { values: { enabled: true, referrerRewardPaise: 10_000, refereeRewardPaise: 5_000, minOrderPaise: 10_000, maxRewardsPerReferrer: 0, autoApprove: true } }, actor);
  const make = (name) => User.create({ role: 'CUSTOMER', name, email: `${name}@fraud.test`, status: 'ACTIVE' });
  const [mona, sona, tina] = await Promise.all([make('mona'), make('sona'), make('tina')]);
  const code = await getOrCreateCode(mona._id);
  await Device.create([
    { userId: String(mona._id), deviceId: 'phone-1', token: 'tok-1', platform: 'android' },
    { userId: String(sona._id), deviceId: 'phone-1', token: 'tok-2', platform: 'android' },
    { userId: String(tina._id), deviceId: 'phone-9', token: 'tok-3', platform: 'android' },
  ]);
  await attachReferral({ code, refereeId: sona._id });
  await attachReferral({ code, refereeId: tina._id });
  const order = (customerId) => ({ _id: new mongoose.Types.ObjectId(), customerId: String(customerId), address: { line: '1 Elm St', pincode: '380015' }, totals: { subtotalPaise: 50_000, couponDiscountPaise: 0 } });
  await qualifyOnDelivered(order(sona._id));
  await qualifyOnDelivered(order(tina._id));
  const flagged = await Referral.findOne({ refereeId: String(sona._id) });
  assert.deepEqual([flagged.status, flagged.flags], ['QUALIFIED', ['SAME_DEVICE']], 'auto-approve is on, but a flagged referral still waits');
  assert.equal(await getBalance(sona._id), 0);
  assert.equal((await Referral.findOne({ refereeId: String(tina._id) })).status, 'REWARDED', 'a clean one is paid straight away');

  const history = await getCustomerReferrals(mona._id);
  assert.deepEqual([history.code, history.invited.length, history.earnedPaise, history.invited.find((r) => r.name === 'sona').flags], [code, 2, 10_000, ['SAME_DEVICE']]);
  assert.equal((await getCustomerReferrals(sona._id)).referredBy.name, 'mona');
  await decideReferral(flagged._id, { decision: 'APPROVE' }, actor); // an admin can still approve after looking
  assert.equal(await getBalance(sona._id), 5_000);

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/invite`;
  const ok = await fetch(`${base}/${code}`);
  const html = await ok.text();
  assert.equal(ok.status, 200);
  assert.ok(html.includes(code) && html.includes(`arise://signup?referralCode=${code}`) && html.includes('mona invited you'));
  assert.equal((await fetch(`${base}/NOPE1234`)).status, 404);
});
