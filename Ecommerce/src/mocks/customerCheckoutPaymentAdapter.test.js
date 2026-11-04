import { resetCustomerAddressFixture } from './customerAddressAdapter';
import { resetCustomerCartFixture } from './customerCartAdapter';
import {
  customerCheckoutPaymentFixtureAdapter,
  resetCustomerCheckoutPaymentFixture,
} from './customerCheckoutPaymentAdapter';

const post = (url, data, key) =>
  customerCheckoutPaymentFixtureAdapter({
    url,
    method: 'post',
    data,
    headers: key ? { 'Idempotency-Key': key } : {},
  });

describe('customerCheckoutPaymentFixtureAdapter', () => {
  beforeEach(() => {
    resetCustomerAddressFixture();
    resetCustomerCartFixture();
    resetCustomerCheckoutPaymentFixture();
  });

  it('creates an immutable checkout quote from server cart totals', async () => {
    const result = await post(
      '/checkout/sessions',
      { source: 'CART', addressId: 'addr-1', cartVersion: 1 },
      'checkout-key',
    );
    expect(result.data.data).toMatchObject({ source: 'CART', status: 'READY' });
    expect(result.data.data.lines).toHaveLength(1);
    expect(result.data.data.totals.payablePaise).toBe(30700);
  });

  it('deduplicates checkout, payment and order creation keys', async () => {
    const firstSession = await post(
      '/checkout/sessions',
      { source: 'CART', addressId: 'addr-1' },
      'checkout-key',
    );
    const secondSession = await post(
      '/checkout/sessions',
      { source: 'CART', addressId: 'addr-1' },
      'checkout-key',
    );
    expect(secondSession.data.data.id).toBe(firstSession.data.data.id);

    const sessionId = firstSession.data.data.id;
    const firstIntent = await post(
      `/checkout/sessions/${sessionId}/payment-intent`,
      { method: 'upi' },
      'payment-key',
    );
    const secondIntent = await post(
      `/checkout/sessions/${sessionId}/payment-intent`,
      { method: 'upi' },
      'payment-key',
    );
    expect(secondIntent.data.data.id).toBe(firstIntent.data.data.id);

    const paymentId = firstIntent.data.data.id;
    await post(`/payments/${paymentId}/confirm`, {});
    const firstOrder = await post(
      '/orders',
      { checkoutSessionId: sessionId, paymentId },
      'order-key',
    );
    const secondOrder = await post(
      '/orders',
      { checkoutSessionId: sessionId, paymentId },
      'order-key',
    );
    expect(secondOrder.data.data.id).toBe(firstOrder.data.data.id);
  });

  it('rejects order creation before payment confirmation', async () => {
    const session = await post(
      '/checkout/sessions',
      { source: 'CART', addressId: 'addr-1' },
      'checkout-key',
    );
    const intent = await post(
      `/checkout/sessions/${session.data.data.id}/payment-intent`,
      { method: 'card' },
      'payment-key',
    );
    await expect(
      post(
        '/orders',
        { checkoutSessionId: session.data.data.id, paymentId: intent.data.data.id },
        'order-key',
      ),
    ).rejects.toMatchObject({
      response: { status: 409, data: { error: { code: 'PAYMENT_NOT_CONFIRMED' } } },
    });
  });
});
