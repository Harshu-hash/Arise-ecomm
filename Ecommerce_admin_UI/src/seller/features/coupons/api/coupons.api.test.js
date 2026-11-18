import { describe, expect, it } from 'vitest';
import { sellerCouponsApi } from './coupons.api';

const base = {
  name: 'Test', type: 'PERCENT', valuePct: 10, totalLimit: 100, perUserLimit: 1,
  startsAt: new Date(Date.now() - 86_400_000).toISOString(),
  endsAt: new Date(Date.now() + 86_400_000).toISOString(),
};

describe('sellerCouponsApi', () => {
  it('creates an active coupon when its window is open', async () => {
    const { data } = await sellerCouponsApi.create({ ...base, code: 'newcode1' });
    expect(data.code).toBe('NEWCODE1'); // upper-cased
    expect(data.status).toBe('ACTIVE');
  });

  it('marks a future coupon as scheduled', async () => {
    const { data } = await sellerCouponsApi.create({
      ...base, code: 'FUTURE1',
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(data.status).toBe('SCHEDULED');
  });

  it('rejects a duplicate code', async () => {
    await sellerCouponsApi.create({ ...base, code: 'DUPE1' });
    await expect(sellerCouponsApi.create({ ...base, code: 'dupe1' })).rejects.toThrow(/already exists/);
  });

  it('pausing then ending drives status through PAUSED to EXPIRED', async () => {
    const { data: created } = await sellerCouponsApi.create({ ...base, code: 'LIFE1' });
    expect((await sellerCouponsApi.setPaused(created.id, true)).data.status).toBe('PAUSED');
    expect((await sellerCouponsApi.end(created.id)).data.status).toBe('EXPIRED');
  });
});
