import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@mocks/db/store';
import { seedAll } from '@mocks/seed';
import { analyticsView } from './sellerAnalytics';

describe('seller sales report projection', () => {
  beforeEach(seedAll);

  it('reconciles daily GMV and order counts with the headline totals', () => {
    const seller = db.sellers.find((row) => row.status === 'ACTIVE');
    const report = analyticsView(seller.id, 'overview', new URLSearchParams({ from: '2020-01-01', to: '2099-12-31' }));
    expect(report.salesSeries.reduce((sum, row) => sum + row.gmvPaise, 0)).toBe(report.kpis.gmvPaise);
    expect(report.salesSeries.reduce((sum, row) => sum + row.orders, 0)).toBe(report.kpis.salesOrders);
    expect(new Set(db.orderItems.filter((row) => row.sellerId === seller.id).map((row) => row.orderId)).size).toBeGreaterThanOrEqual(report.kpis.orders);
    expect(report.salesSeries.every((row) => row.orders > 0 && row.units > 0)).toBe(true);
  });
});
