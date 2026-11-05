import { describe, expect, it } from 'vitest';
import { shouldAttemptSessionRefresh } from './useBootstrapSession';

describe('session bootstrap policy', () => {
  it('uses an HttpOnly refresh cookie in live mode without a JavaScript token', () => {
    expect(shouldAttemptSessionRefresh(false, null)).toBe(true);
  });

  it('requires the development token in mock mode', () => {
    expect(shouldAttemptSessionRefresh(true, null)).toBe(false);
    expect(shouldAttemptSessionRefresh(true, 'mock-refresh')).toBe(true);
  });
});
