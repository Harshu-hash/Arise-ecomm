import { createHomeFixtureEnvelope } from '@mocks/customerHomeAdapter';
import { mapAppConfigResponse, mapHomeResponse } from './home.mapper';

describe('home contract mapper', () => {
  it('maps wire money in paise to the current display model', () => {
    const home = mapHomeResponse(createHomeFixtureEnvelope());

    const items = type => home.sections.find(section => section.type === type).items;

    expect(home.version).toBe('fixture-home-v1');
    expect(home.header.categoryTabs.length).toBeGreaterThan(0);
    expect(items('SUGGESTED_PRODUCTS')[0]).toMatchObject({
      id: 'sp1',
      price: 118,
      mrp: 699,
    });
    expect(items('PRODUCT_FEED')).toHaveLength(10);
  });

  it('keeps the server order, places each flash sale on its own, and joins adjacent deals', () => {
    const payload = createHomeFixtureEnvelope();
    const section = (id, type, items) => ({ id, type, status: 'READY', items });
    const sale = id => ({ id, title: `Sale ${id}`, subtitle: 'Go', endsAt: '2027-01-01T00:00:00.000Z' });
    const deal = id => ({ id, imageUrl: 'https://example.com/d.png', label: id, value: 'Up to 50% Off' });
    const hero = payload.data.sections.find(s => s.type === 'HERO');
    payload.data.sections = [
      section('flash-sale-f2', 'FLASH_SALE', [sale('f2')]),
      section('top-value-deal-d1', 'TOP_VALUE_DEALS', [deal('d1')]),
      section('top-value-deal-d2', 'TOP_VALUE_DEALS', [deal('d2')]),
      section('feed', 'PRODUCT_FEED', []),
      hero, // pinned on top by the screen wherever it arrives
      section('flash-sale-f1', 'FLASH_SALE', [sale('f1')]),
    ];

    const home = mapHomeResponse(payload);
    expect(home.heroBanners).toHaveLength(hero.items.length);
    expect(home.sections.map(s => [s.type, s.items.map(item => item.id)])).toEqual([
      ['FLASH_SALE', ['f2']],
      ['TOP_VALUE_DEALS', ['d1', 'd2']],
      ['FLASH_SALE', ['f1']],
    ]);
  });

  it('isolates a failed section without discarding ready sections', () => {
    const payload = createHomeFixtureEnvelope();
    const failed = payload.data.sections.find(section => section.type === 'BRAND_SPOTLIGHT');
    failed.status = 'ERROR';
    failed.errorMessage = 'Campaign service unavailable';
    failed.items = [{ intentionally: 'invalid' }];

    const home = mapHomeResponse(payload);
    expect(home.sections.some(section => section.type === 'BRAND_SPOTLIGHT')).toBe(false);
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
