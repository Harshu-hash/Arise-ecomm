/* eslint-disable no-restricted-imports -- a smoke test that drives both panels (seller requests, admin pays) has to import from both */
import { App as AntApp } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, setApiBaseUrl } from '@core/api/axiosInstance';
import { queryClient } from '@core/api/queryClient';
import { useSessionStore } from '@core/auth/sessionStore';
import WithdrawalsPage from '@admin/features/finance/pages/WithdrawalsPage';
import { sellerHandlers } from '@seller/mocks/handlers';
import { signInSeller } from '@seller/test/signInSeller';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import WalletPage from '@seller/features/finance/pages/WalletPage';
import { find } from './db/store';
import { handlers } from './handlers';
import { withdrawals } from './engine/walletMock';
import { seedAll } from './seed';
import { DEMO_PASSWORD } from './seed/adminUsers';
import { resetSettings, updateSettings } from './engine/settings';

/**
 * Smoke test for the wallet screens: the seller's Wallet page and the admin's Withdrawals queue are rendered for real (mock backend)
 * and driven through a whole withdrawal: request, approve, record the payment.
 */
const server = setupServer(...handlers, ...sellerHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  seedAll();
  seedSellerAccounts();
  resetSettings();
  updateSettings({ latencyMs: 0 });
  withdrawals.length = 0;
  queryClient.clear();
});

const page = (node) => render(
  <QueryClientProvider client={queryClient}><AntApp><MemoryRouter>{node}</MemoryRouter></AntApp></QueryClientProvider>,
);

describe('wallet screens', () => {
  it('a seller requests a withdrawal and an admin approves and pays it', async () => {
    const user = userEvent.setup();

    // ---- the seller
    setApiBaseUrl('/api/seller/v1');
    await signInSeller();
    const sellerId = find('sellerUsers', (u) => u.email === 'owner@arise.test').sellerId;
    const { db } = await import('./db/store');
    db.settlementLines.push({ id: 'STL-SMOKE', sellerId, sellerName: 'Smoke seller', orderId: 'ORD-SMOKE', productTitle: 'Smoke item', eligible: true, settledAt: null, netPaise: 400_000, salePaise: 450_000 });

    const seller = page(<WalletPage />);
    expect(await screen.findByText('Available to withdraw')).toBeInTheDocument();
    expect(await screen.findByText('No withdrawals yet')).toBeInTheDocument();
    const withdraw = await screen.findByRole('button', { name: /^Withdraw$/ });
    await waitFor(() => expect(withdraw).toBeEnabled()); // enabled once the wallet has loaded
    await user.click(withdraw);
    await user.type(await screen.findByLabelText(/Amount/), '1000');
    await user.click(screen.getByRole('button', { name: /Request withdrawal/ }));
    expect(await screen.findByText('Waiting for approval')).toBeInTheDocument();
    expect(withdrawals).toHaveLength(1);
    await user.click(screen.getByText('Wallet activity'));
    expect(await screen.findByText('No wallet activity yet')).toBeInTheDocument();
    seller.unmount();
    useSessionStore.getState().setAnonymous();
    queryClient.clear();

    // ---- the admin
    setApiBaseUrl('/api/admin/v1');
    const login = await api.post('/auth/login', { email: 'super@arise.test', password: DEMO_PASSWORD });
    useSessionStore.getState().setAuthenticated(login.data);
    page(<WithdrawalsPage />);
    expect(await screen.findByText('Seller withdrawals')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    const confirm = await screen.findByRole('dialog');
    await user.click(within(confirm).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(withdrawals[0].status).toBe('APPROVED'));
    await user.click(await screen.findByRole('button', { name: 'Record payment' }));
    await user.type(await screen.findByLabelText(/transaction number/i), 'UTR1234567');
    await user.click(screen.getByRole('button', { name: 'Mark as paid' }));
    await waitFor(() => expect(withdrawals[0]).toMatchObject({ status: 'PAID', txnNo: 'UTR1234567' }));
    expect(await screen.findByText('Paid')).toBeInTheDocument();
    useSessionStore.getState().setAnonymous();
    setApiBaseUrl('/api/admin/v1');
  }, 60_000);
});
