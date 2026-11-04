import {
  mapCommunicationPreferences,
  mapDeletionEligibility,
  mapExportRequest,
} from './privacy.mapper';

describe('privacy mappers', () => {
  it('validates communication preferences', () => {
    expect(
      mapCommunicationPreferences({
        data: {
          orderUpdatesPush: true,
          orderUpdatesEmail: true,
          orderUpdatesSms: true,
          offersPush: false,
          offersEmail: false,
          offersSms: false,
          recommendationsPush: true,
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      }).offersPush,
    ).toBe(false);
  });
  it('accepts an empty export state', () => {
    expect(mapExportRequest({ data: null })).toBeNull();
  });
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
