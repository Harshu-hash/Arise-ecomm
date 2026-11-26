import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SMS_OTP_MOCK = 'true';
process.env.SMS_OTP_MOCK_CODE = '4321';
const { makeOtp } = await import('../src/modules/identity/application/customerAuth.service.js');

test('mock mode fixes phone OTPs only', () => {
  assert.equal(makeOtp('phone'), '4321');
  assert.match(makeOtp('email'), /^\d{4}$/);
});
