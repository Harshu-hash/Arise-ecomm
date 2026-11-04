import {
  customerPrivacyFixtureAdapter,
  resetCustomerPrivacyFixture,
  setDeletionBlockersFixture,
} from './customerPrivacyAdapter';

describe('customerPrivacyFixtureAdapter', () => {
  beforeEach(resetCustomerPrivacyFixture);
  it('persists communication preferences', async () => {
    await customerPrivacyFixtureAdapter({
      url: '/me/communication-preferences',
      method: 'patch',
      data: { offersEmail: true },
    });
    const response = await customerPrivacyFixtureAdapter({
      url: '/me/communication-preferences',
      method: 'get',
    });
    expect(response.data.data.offersEmail).toBe(true);
  });
  it('creates only one active export request', async () => {
    const first = await customerPrivacyFixtureAdapter({
      url: '/privacy/export-request',
      method: 'post',
    });
    const second = await customerPrivacyFixtureAdapter({
      url: '/privacy/export-request',
      method: 'post',
    });
    expect(second.data.data.id).toBe(first.data.data.id);
    expect(first.data.data.status).toBe('REQUESTED');
  });
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
