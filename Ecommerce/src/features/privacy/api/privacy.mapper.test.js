import { mapDeletionEligibility } from './privacy.mapper';

describe('privacy mappers', () => {
  it('validates deletion blockers', () => {
    expect(
      mapDeletionEligibility({
        data: {
          eligible: false,
          blockers: [{ code: 'ACTIVE_ORDERS', message: 'Wait for delivery.', resolvesAt: null }],
          existingRequest: null,
        },
      }).blockers,
    ).toHaveLength(1);
  });
  it('rejects inconsistent blocker codes', () => {
    expect(() =>
      mapDeletionEligibility({
        data: {
          eligible: false,
          blockers: [{ code: 'UNKNOWN', message: 'Unknown.', resolvesAt: null }],
          existingRequest: null,
        },
      }),
    ).toThrow();
  });
});
