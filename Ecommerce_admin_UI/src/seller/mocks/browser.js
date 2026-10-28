import { setupWorker } from 'msw/browser';
import { seedAll } from '@mocks/seed';
import { clearSnapshot, restoreIfPresent, saveSnapshot } from '@mocks/persistence';
import { db } from '@mocks/db/store';
import { sellerHandlers } from './handlers';
import { seedSellerAccounts } from './seed/sellerAccounts';

export const worker = setupWorker(...sellerHandlers);

/**
 * Boots the seller app's mock backend against the SAME shared in-memory DB as
 * the admin panel. If a snapshot exists (e.g. the admin app already seeded on
 * this origin) it is restored; otherwise the shared `seedAll` runs. Either way
 * `seedSellerAccounts` tops up the seller login rows (idempotent), so a seller
 * can sign in regardless of which app seeded first.
 */
export async function startMockServer() {
  const restored = await restoreIfPresent();
  if (!restored) seedAll();

  const before = db.sellerUsers.length;
  seedSellerAccounts();
  if (!restored || db.sellerUsers.length !== before) await saveSnapshot();

  await worker.start({
    onUnhandledRequest: (req, print) => {
      const url = new URL(req.url);
      if (!url.pathname.startsWith('/api/')) return;
      print.warning();
    },
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  });

  return { restored };
}

/** Wipe everything and rebuild from the shared seed + seller accounts. */
export async function resetMockData() {
  await clearSnapshot();
  seedAll();
  seedSellerAccounts();
  await saveSnapshot();
}
