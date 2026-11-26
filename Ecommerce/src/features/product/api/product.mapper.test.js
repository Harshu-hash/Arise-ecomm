import { createProductDetailFixtureEnvelope } from '@mocks/customerSearchProductAdapter';
import { mapProductDetail, mapRelatedProducts } from './product.mapper';

describe('product contract mapper', () => {
  it('maps wire money and detail fields to the product screen model', () => {
    const product = mapProductDetail(createProductDetailFixtureEnvelope('m1'));

    expect(product).toMatchObject({
      id: 'm1',
      price: expect.any(Number),
      mrp: expect.any(Number),
      images: expect.any(Array),
      available: true,
    });
    expect(product.images.length).toBeGreaterThan(0);
  });

  it('rejects malformed product money from the backend', () => {
    const payload = createProductDetailFixtureEnvelope('m1');
    payload.data.pricePaise = 10.5;

    expect(() => mapProductDetail(payload)).toThrow();
  });

  it('maps a product with no size chart to null, not a crash', () => {
    const product = mapProductDetail(createProductDetailFixtureEnvelope('m1'));
    expect(product.sizeChart).toBeNull();
    expect(product.specifications.length).toBeGreaterThan(0);
  });

  it('maps a generic columns/rows size chart for a product that has one', () => {
    const product = mapProductDetail(createProductDetailFixtureEnvelope('f1'));
    expect(Array.isArray(product.sizeChart.columns)).toBe(true);
    expect(Array.isArray(product.sizeChart.rows[0])).toBe(true);
  });
});

describe('related products', () => {
  const card = { id: 'p2', name: 'Phone', brand: 'Acme', category: 'Phones', imageUrl: 'https://x.test/p.jpg', pricePaise: 50000, mrpPaise: 60000 };
  it('maps both lists to app cards, in rupees', () => {
    const { similar, suggested } = mapRelatedProducts({ data: { similar: [card], suggested: [] } });
    expect(similar[0]).toMatchObject({ id: 'p2', image: 'https://x.test/p.jpg', price: 500, mrp: 600 });
    expect(suggested).toEqual([]);
  });
});
