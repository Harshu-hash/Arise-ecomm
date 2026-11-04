import fs from 'fs';
import path from 'path';

const contractPath = path.resolve(__dirname, '../../docs/api/customer-v1.openapi.yaml');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const operations = Object.entries(contract.paths).flatMap(([route, pathItem]) =>
  Object.entries(pathItem)
    .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
    .map(([method, operation]) => ({ route, method, operation, pathItem })),
);

describe('customer API contract', () => {
  test('is OpenAPI 3.1 and covers every customer capability boundary', () => {
    expect(contract.openapi).toBe('3.1.0');
    [
      '/auth/start',
      '/app-config',
      '/home',
      '/products/{productId}',
      '/cart',
      '/checkout/sessions',
      '/checkout/sessions/{checkoutSessionId}/payment-intent',
      '/payment-methods/setup-sessions',
      '/orders',
      '/returns',
      '/wallet',
      '/support/tickets',
      '/support/channels',
      '/seller-leads',
    ].forEach(route => expect(contract.paths[route]).toBeDefined());
  });

  test('has a unique operationId for every operation', () => {
    const ids = operations.map(({ operation }) => operation.operationId);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('requires idempotency keys on irreversible customer commands', () => {
    const commandIds = new Set([
      'createCheckoutSession',
      'createPayment',
      'createOrder',
      'cancelOrder',
      'createReturn',
      'cancelReturn',
      'redeemGiftCard',
      'createSupportTicket',
      'replyToSupportTicket',
      'submitSellerLead',
    ]);
    operations
      .filter(({ operation }) => commandIds.has(operation.operationId))
      .forEach(({ operation, pathItem }) => {
        const parameters = [...(pathItem.parameters || []), ...(operation.parameters || [])];
        expect(parameters).toContainEqual({ $ref: '#/components/parameters/IdempotencyKey' });
      });
  });

  test('locks lifecycle enums shared with mobile clients and backend services', () => {
    expect(contract.components.schemas.OrderStatus.enum).toEqual([
      'PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'PACKED', 'READY_TO_SHIP', 'SHIPPED',
      'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PAYMENT_FAILED', 'DELIVERY_FAILED',
      'CANCELLED',
    ]);
    expect(contract.components.schemas.RefundStatus.enum).toEqual([
      'NOT_REQUIRED', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED',
    ]);
    expect(contract.components.schemas.PaymentStatus.enum).toEqual([
      'CREATED', 'REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'UNKNOWN',
    ]);
  });
});
