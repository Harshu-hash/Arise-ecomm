import { createProductDetailFixtureEnvelope } from '@mocks/customerSearchProductAdapter';
import { mapProductDetail } from './product.mapper';

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
