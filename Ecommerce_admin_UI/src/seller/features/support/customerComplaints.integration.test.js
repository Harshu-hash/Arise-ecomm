import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { find, findById, update } from '@mocks/db/store';
import { seedAll } from '@mocks/seed';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { signInSeller } from '@seller/test/signInSeller';
import { supportApi } from './api/support.api';

const server = setupServer(...sellerHandlers);

describe('seller customer complaints', () => {
  let sellerId;
  beforeAll(() => { setApiBaseUrl('/api/seller/v1'); server.listen({ onUnhandledRequest: 'error' }); });
  beforeEach(async () => { seedAll(); seedSellerAccounts(); sellerId = find('sellerUsers', (user) => user.email === 'owner@arise.test').sellerId; await signInSeller(); });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('scopes complaints to the seller, hides internal notes and resolves a complaint', async () => {
    const result = await supportApi.customerComplaints();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((ticket) => findById('tickets', ticket.id).sellerId === sellerId)).toBe(true);

    const complaint = result.data[0];
    expect(complaint).toBeTruthy();
    update('tickets', complaint.id, { status: 'OPEN', resolvedAt: null, resolutionCode: null });
    const detail = await supportApi.customerComplaint(complaint.id);
    expect(detail.events.every((event) => event.visibility !== 'INTERNAL')).toBe(true);

    await supportApi.replyToCustomer(complaint.id, 'We are checking this with our fulfilment team.');
    const resolved = await supportApi.resolveCustomerComplaint(complaint.id, 'A replacement has been dispatched.');
    expect(resolved.status).toBe('RESOLVED');
    expect(findById('tickets', complaint.id).resolutionCode).toBe('RESOLVED_BY_SELLER');
  });
});
