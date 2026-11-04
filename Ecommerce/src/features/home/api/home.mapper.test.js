import { createHomeFixtureEnvelope } from '@mocks/customerHomeAdapter';
import { mapAppConfigResponse, mapHomeResponse } from './home.mapper';

describe('home contract mapper', () => {
  it('maps wire money in paise to the current display model', () => {
    const home = mapHomeResponse(createHomeFixtureEnvelope());

    expect(home.version).toBe('fixture-home-v1');
    expect(home.header.categoryTabs.length).toBeGreaterThan(0);
    expect(home.suggestedProducts[0]).toMatchObject({
      id: 'sp1',
      price: 118,
      mrp: 699,
    });
    expect(home.productFeed).toHaveLength(10);
  });

  it('isolates a failed section without discarding ready sections', () => {
    const payload = createHomeFixtureEnvelope();
    const failed = payload.data.sections.find(section => section.type === 'BRAND_SPOTLIGHT');
    failed.status = 'ERROR';
    failed.errorMessage = 'Campaign service unavailable';
    failed.items = [{ intentionally: 'invalid' }];

    const home = mapHomeResponse(payload);
    expect(home.brandsSpotlight).toEqual([]);
    expect(home.heroBanners).not.toEqual([]);
    expect(home.failedSections).toEqual([expect.objectContaining({ type: 'BRAND_SPOTLIGHT' })]);
  });

  it('rejects malformed known section items', () => {
    const payload = createHomeFixtureEnvelope();
    const products = payload.data.sections.find(section => section.type === 'PRODUCT_FEED');
    products.items[0].pricePaise = 12.5;

    expect(() => mapHomeResponse(payload)).toThrow();
  });

  it('validates application configuration', () => {
    expect(
      mapAppConfigResponse({
        data: {
          minimumSupportedVersion: '1.0.0',
          latestVersion: '1.1.0',
          maintenance: { enabled: false, message: null },
          storeUrls: {
            android: 'market://details?id=com.ariseecommerce',
            ios: 'https://apps.apple.com/app/arise-marketplace/id0000000000',
          },
          featureFlags: { wallet: true },
        },
      }),
    ).toMatchObject({ latestVersion: '1.1.0', featureFlags: { wallet: true } });
  });
});
