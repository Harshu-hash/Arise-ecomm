import { beforeAll, describe, expect, it } from 'vitest';
import { db, find } from '@mocks/db/store';
import { seedAll } from '@mocks/seed';
import { publicUser } from '@seller/mocks/engine/sellerAuth';
import { seedSellerAccounts } from './sellerAccounts';

describe('seller account seed', () => {
  beforeAll(() => {
    seedAll();
    seedSellerAccounts();
  });

  it('creates the demo logins linked to real sellers', () => {
    const owner = find('sellerUsers', (u) => u.email === 'owner@arise.test');
    expect(owner).toBeTruthy();
    expect(owner.roleKey).toBe('owner');
    expect(owner.permissions).toEqual(['*']);
    expect(find('sellers', (s) => s.id === owner.sellerId)).toBeTruthy();
  });

  it('is idempotent — a second run adds no duplicates', () => {
    const before = db.sellerUsers.length;
    seedSellerAccounts();
    expect(db.sellerUsers.length).toBe(before);
  });

  it('an active owner is onboarding-complete and lands on the dashboard', () => {
    const owner = find('sellerUsers', (u) => u.email === 'owner@arise.test');
    const pub = publicUser(owner);
    expect(pub.onboardingComplete).toBe(true);
    expect(pub.defaultLanding).toBe('/');
    expect(pub.storeName).toBeTruthy();
  });

  it('a mid-onboarding seller is gated to the wizard', () => {
    const pending = find('sellerUsers', (u) => u.email === 'newseller@arise.test');
    const pub = publicUser(pending);
    expect(pub.onboardingComplete).toBe(false);
    expect(pub.defaultLanding).toBe('/onboarding');
    expect(find('sellerOnboarding', (o) => o.sellerId === pending.sellerId)).toBeTruthy();
  });
});
