import { customerHomeFixtureAdapter } from './customerHomeAdapter';

describe('customerHomeFixtureAdapter', () => {
  it('serves the versioned home feed contract', async () => {
    const response = await customerHomeFixtureAdapter({ url: '/home', method: 'get' });

    expect(response.status).toBe(200);
    expect(response.data.data).toMatchObject({
      version: 'fixture-home-v1',
      header: expect.any(Object),
      sections: expect.any(Array),
    });
  });

  it('serves application configuration', async () => {
    const response = await customerHomeFixtureAdapter({ url: '/app-config', method: 'get' });

    expect(response.data.data.maintenance.enabled).toBe(false);
    expect(response.data.data.featureFlags).toEqual(expect.any(Object));
  });
});
