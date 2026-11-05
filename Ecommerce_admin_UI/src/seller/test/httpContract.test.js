import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api, http } from '@core/api/axiosInstance';
import { financeApi } from '@seller/features/finance/api/finance.api';
import { supportApi } from '@seller/features/support/api/support.api';

describe('production HTTP contract behavior', () => {
  let originalAdapter;
  let requests;

  beforeEach(() => {
    originalAdapter = http.defaults.adapter;
    requests = [];
    http.defaults.adapter = async (config) => {
      requests.push(config);
      return {
        data: { data: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };
  });

  afterEach(() => {
    http.defaults.adapter = originalAdapter;
  });

  it('encodes list filters exactly once', async () => {
    await supportApi.help('settlement');
    await financeApi.documents({ entityType: 'PAYOUT', entityId: 'pay_1' });

    expect(requests[0].params).toEqual({ q: 'settlement' });
    expect(requests[1].params).toEqual({ entityType: 'PAYOUT', entityId: 'pay_1' });
  });

  it('adds a command idempotency key and preserves an explicit workflow key', async () => {
    await api.post('/orders/order_1/confirm', {});
    await api.post('/exports', {}, { headers: { 'Idempotency-Key': 'export-stable-key' } });

    expect(requests[0].headers.get('Idempotency-Key')).toMatch(/\S{8,}/);
    expect(requests[1].headers.get('Idempotency-Key')).toBe('export-stable-key');
  });
});
