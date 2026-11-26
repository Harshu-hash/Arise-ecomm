import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { sellerInquiryBody } from '../src/modules/identity/presentation/sellerInquiry.routes.js';

const valid = {
  businessName: 'Asha Stores',
  email: 'asha@example.com',
  gstin: '27AAPFU0939F1ZV',
  mobile: '9876512345',
  pickupPincode: '395007',
  consentVersion: 'seller-lead-v1',
};

test('seller inquiry validates the customer form at the API boundary', () => {
  assert.deepEqual(sellerInquiryBody.parse(valid), valid);
  assert.equal(sellerInquiryBody.safeParse({ ...valid, gstin: 'bad' }).success, false);
  assert.equal(sellerInquiryBody.safeParse({ ...valid, email: '' }).success, false);
  assert.equal(sellerInquiryBody.safeParse({ ...valid, customerId: 'forged' }).success, false);
});

test('seller inquiry endpoint requires a customer and rejects an invalid form before writing', async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/customer/v1/seller-leads`;
  const post = (body, role) => fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': 'seller-inquiry-test',
      ...(role ? { authorization: `Bearer ${signAccessToken({ sub: '507f1f77bcf86cd799439011', role })}` } : {}),
    },
    body: JSON.stringify(body),
  });

  assert.equal((await post(valid)).status, 401);
  assert.equal((await post(valid, 'SELLER')).status, 403);
  assert.equal((await post({ ...valid, pickupPincode: '000000' }, 'CUSTOMER')).status, 422);
  assert.equal((await fetch(`${url}/me`)).status, 401);
});
