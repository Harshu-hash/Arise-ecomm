import {
  customerPrivacyFixtureAdapter,
  resetCustomerPrivacyFixture,
  setDeletionBlockersFixture,
} from './customerPrivacyAdapter';

describe('customerPrivacyFixtureAdapter', () => {
  beforeEach(resetCustomerPrivacyFixture);
  it('exposes deletion blockers and rejects unsafe deletion', async () => {
    const status = await customerPrivacyFixtureAdapter({
      url: '/privacy/deletion-eligibility',
      method: 'get',
    });
    expect(status.data.data).toMatchObject({
      eligible: false,
      blockers: [{ code: 'ACTIVE_ORDERS' }],
    });
    await expect(
      customerPrivacyFixtureAdapter({
        url: '/privacy/deletion-request',
        method: 'post',
        data: { reasonCode: 'OTHER', acknowledged: true },
      }),
    ).rejects.toMatchObject({ response: { status: 409 } });
  });
  it('schedules deletion only after eligibility and acknowledgement', async () => {
    setDeletionBlockersFixture([]);
    const response = await customerPrivacyFixtureAdapter({
      url: '/privacy/deletion-request',
      method: 'post',
      data: { reasonCode: 'NOT_USING', acknowledged: true },
    });
    expect(response.data.data).toMatchObject({
      eligible: true,
      existingRequest: { status: 'SCHEDULED' },
    });
  });
});
