import { beforeAll, describe, expect, it } from 'vitest';
import { find } from '@mocks/db/store';
import { seedAll } from '@mocks/seed';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { recentActivity } from './sellerActivity';

describe('seller recent-activity feed', () => {
  let sellerId;

  beforeAll(() => {
    seedAll();
    seedSellerAccounts();
    sellerId = find('sellerUsers', (u) => u.email === 'owner@arise.test').sellerId;
  });

  it('returns events in known shape, newest first, capped at the limit', () => {
    const events = recentActivity(sellerId, 5);
    expect(events.length).toBeLessThanOrEqual(5);
    for (const e of events) {
      expect(e).toHaveProperty('id');
      expect(e).toHaveProperty('title');
      expect(e).toHaveProperty('at');
      expect(['system', 'seller', 'customer', 'courier']).toContain(e.actorType);
    }
    for (let i = 1; i < events.length; i += 1) {
      expect(new Date(events[i - 1].at).getTime()).toBeGreaterThanOrEqual(new Date(events[i].at).getTime());
    }
  });
});
