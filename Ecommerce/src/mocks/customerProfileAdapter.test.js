import {
  customerProfileFixtureAdapter,
  resetCustomerProfileFixture,
} from './customerProfileAdapter';

describe('customerProfileFixtureAdapter', () => {
  beforeEach(resetCustomerProfileFixture);
  it('returns masked verified contact details', async () => {
    const response = await customerProfileFixtureAdapter({ url: '/me', method: 'get' });
    expect(response.data.data).toMatchObject({
      emailMasked: 'h***@gmail.com',
      phoneVerified: true,
    });
    expect(response.data.data.emailMasked).not.toContain('harshvardhan');
  });
  it('persists non-sensitive profile fields', async () => {
    const response = await customerProfileFixtureAdapter({
      url: '/me',
      method: 'patch',
      data: { name: 'Updated Customer', gender: 'OTHER' },
    });
    expect(response.data.data).toMatchObject({
      name: 'Updated Customer',
      gender: 'OTHER',
      pendingVerification: null,
    });
  });
  it('creates a verification challenge without replacing current contact', async () => {
    const response = await customerProfileFixtureAdapter({
      url: '/me',
      method: 'patch',
      data: { newEmail: 'new@example.com' },
    });
    expect(response.data.data).toMatchObject({
      emailMasked: 'h***@gmail.com',
      pendingVerification: { field: 'EMAIL', destinationMasked: 'n***@example.com' },
    });
  });
  it('returns field errors for invalid updates', async () => {
    await expect(
      customerProfileFixtureAdapter({
        url: '/me',
        method: 'patch',
        data: { name: 'A', newPhone: '9876' },
      }),
    ).rejects.toMatchObject({
      response: {
        status: 422,
        data: {
          error: { fieldErrors: { name: expect.any(String), newPhone: expect.any(String) } },
        },
      },
    });
  });
});
