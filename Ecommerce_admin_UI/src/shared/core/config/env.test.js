import { describe, expect, it } from 'vitest';
import { apiBaseForAudience } from './env';

describe('audience API base', () => {
  it('preserves the configured origin while replacing the audience namespace', () => {
    expect(apiBaseForAudience('seller')).toBe('/api/seller/v1');
    expect(apiBaseForAudience('customer')).toBe('/api/customer/v1');
  });
});
