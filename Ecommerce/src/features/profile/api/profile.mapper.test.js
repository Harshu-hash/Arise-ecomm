import { mapProfile } from './profile.mapper';

const payload = {
  data: {
    id: 'cus_1',
    name: 'Arise Customer',
    emailMasked: 'a***@example.com',
    phoneMasked: '+91******3210',
    emailVerified: true,
    phoneVerified: true,
    gender: 'PREFER_NOT_TO_SAY',
    avatarUrl: null,
    pendingVerification: null,
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
};
describe('profile mapper', () => {
  it('validates and labels a masked profile', () => {
    expect(mapProfile(payload)).toMatchObject({
      name: 'Arise Customer',
      genderLabel: 'Prefer not to say',
      emailMasked: 'a***@example.com',
    });
  });
  it('rejects unmasked contract omissions', () => {
    expect(() => mapProfile({ data: { ...payload.data, emailMasked: undefined } })).toThrow();
  });
  it('validates pending verification challenges', () => {
    const result = mapProfile({
      data: {
        ...payload.data,
        pendingVerification: {
          challengeId: 'challenge-1',
          field: 'EMAIL',
          destinationMasked: 'n***@example.com',
          expiresAt: '2026-08-01T00:10:00.000Z',
        },
      },
    });
    expect(result.pendingVerification.field).toBe('EMAIL');
  });
});
