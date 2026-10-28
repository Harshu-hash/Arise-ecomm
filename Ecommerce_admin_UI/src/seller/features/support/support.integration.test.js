import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl, api } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { db, find, findById } from '@mocks/db/store';
import { seedAll } from '@mocks/seed';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { sellerAuthApi } from '../auth/api/auth.api';
import { settingsApi } from '../settings/api/settings.api';
import { supportApi } from './api/support.api';

const server = setupServer(...sellerHandlers);

async function signIn(email = 'owner@arise.test') {
  const payload = await sellerAuthApi.login({ email, password: 'Arise@123456' });
  useSessionStore.getState().setAuthenticated(payload);
  return payload.user;
}

describe('seller support, settings & the final hand-offs', () => {
  let sellerId;

  beforeAll(() => { setApiBaseUrl('/api/seller/v1'); server.listen({ onUnhandledRequest: 'error' }); });
  beforeEach(async () => { seedAll(); seedSellerAccounts(); sellerId = find('sellerUsers', (u) => u.email === 'owner@arise.test').sellerId; await signIn(); });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('raising a ticket lands it in the shared tickets collection, visible to admin', async () => {
    const before = db.tickets.length;
    const ticket = await supportApi.create({ subject: 'Payment Issue', text: 'My last payout looks short.' });
    expect(['NEW', 'OPEN']).toContain(ticket.status);
    expect(db.tickets.length).toBe(before + 1);

    const row = findById('tickets', ticket.id);
    expect(row.requesterType).toBe('SELLER');
    expect(row.sellerId).toBe(sellerId);
    expect(row.channel).toBe('SELLER_PANEL');
    // Admin's ticket queue filters on queueId/status over this exact collection.
    expect(row.queueId).toBeTruthy();
  });

  it('a reply and close follow the shared ticket state machine', async () => {
    const ticket = await supportApi.create({ subject: 'Account Issue', text: 'Need help.' });
    const detail = await supportApi.detail(ticket.id);
    expect(detail.events.length).toBeGreaterThan(0);

    await supportApi.reply(ticket.id, 'Following up on this.');
    const afterReply = await supportApi.detail(ticket.id);
    expect(afterReply.events.length).toBeGreaterThan(detail.events.length);

    const closed = await supportApi.close(ticket.id);
    expect(closed.status).toBe('CLOSED');
    await expect(supportApi.reply(ticket.id, 'one more thing')).rejects.toMatchObject({ code: 'TICKET_CLOSED' });
  });

  it('seller cannot see another seller’s ticket', async () => {
    const other = db.sellers.find((s) => s.status === 'ACTIVE' && s.id !== sellerId);
    const foreignTicket = await (async () => {
      // Raise as owner, then reassign sellerId to simulate another seller's ticket.
      const t = await supportApi.create({ subject: 'Delivery Issue', text: 'x' });
      const row = findById('tickets', t.id);
      row.sellerId = other.id;
      return t;
    })();
    await expect(supportApi.detail(foreignTicket.id)).rejects.toMatchObject({ status: 404 });
  });

  it('inviting a sub-user creates an INVITED account usable via accept-invite', async () => {
    const invited = await settingsApi.inviteUser({ name: 'New Hire', email: 'newhire@arise.test', roleKey: 'order_manager' });
    expect(invited.status).toBe('INVITED');
    expect(invited.inviteToken).toBeTruthy();

    const info = await sellerAuthApi.getInvite(invited.inviteToken);
    expect(info.roleName).toBe('Order Manager');

    const accepted = await sellerAuthApi.acceptInvite({ token: invited.inviteToken, name: 'New Hire', password: 'Arise@123456' });
    expect(accepted.user.roleKey).toBe('order_manager');
    expect(accepted.user.sellerId).toBe(sellerId);
  });

  it('removing a sub-user deactivates them, but the owner cannot be removed', async () => {
    const invited = await settingsApi.inviteUser({ name: 'Temp', email: 'temp@arise.test', roleKey: 'catalog_manager' });
    const revoked = await settingsApi.revokeUser(invited.id);
    expect(revoked.status).toBe('DEACTIVATED');

    const owner = find('sellerUsers', (u) => u.sellerId === sellerId && u.roleKey === 'owner');
    await expect(settingsApi.revokeUser(owner.id)).rejects.toMatchObject({ code: 'CANNOT_REVOKE' });
  });

  it('toggling holiday mode flips the shared seller record admin also reads', async () => {
    const updated = await settingsApi.setVacation(true);
    expect(updated.vacationMode).toBe(true);
    expect(findById('sellers', sellerId).vacationMode).toBe(true);
  });

  it('saving a bank account resets it to pending verification', async () => {
    const result = await settingsApi.setBankAccount({ accountHolder: 'Test Holder', accountNumber: '123456789012', ifsc: 'HDFC0001234', bankName: 'HDFC Bank' });
    expect(result.pennyDropStatus).toBe('PENDING');
    expect(result.sellerId).toBe(sellerId);
  });

  it('adding a second pickup address does not disturb the existing primary', async () => {
    const before = await api.get('/settings/bank').then((r) => r.data);
    const primaryBefore = before.addresses.find((a) => a.isPrimary);

    await settingsApi.addPickupAddress({ line1: 'New Depot', city: 'Pune', state: 'MH', pincode: '411001', contactName: 'Ravi', contactPhone: '9999999999' });
    const after = await api.get('/settings/bank').then((r) => r.data);
    expect(after.addresses.length).toBe(before.addresses.length + 1);
    if (primaryBefore) {
      expect(after.addresses.find((a) => a.id === primaryBefore.id).isPrimary).toBe(true);
    }
  });
});
