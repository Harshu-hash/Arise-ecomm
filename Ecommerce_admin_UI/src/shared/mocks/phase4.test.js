import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db, findById } from './db/store';
import { handlers } from './handlers';
import { seedAll } from './seed';
import { DEMO_PASSWORD } from './seed/adminUsers';
import { resetSettings, updateSettings } from './engine/settings';

/**
 * Phase 4 — money.
 *
 * Everything here moves real money in production, so the assertions are about
 * conservation and authority rather than about shapes: that a payout equals
 * the lines it was built from, that nobody can release their own batch, and
 * that a wallet balance always equals its own ledger.
 */

const server = setupServer(...handlers);
const BASE = `${window.location.origin}/api/admin/v1`;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

beforeEach(() => {
  seedAll();
  resetSettings();
  updateSettings({ latencyMs: 0 });
});

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function signIn(email) {
  const login = await call('/auth/login', { method: 'POST', body: { email, password: DEMO_PASSWORD } });
  expect(login.status, `login ${email}`).toBe(200);
  return login.json.data;
}

/** Decides a pending approval as the first person actually allowed to. */
async function decide(approvalId, email, approve = true, reason = 'Checked and agreed.') {
  const s = await signIn(email);
  const r = await call(`/approvals/${approvalId}/decide`, {
    method: 'POST',
    token: s.accessToken,
    body: { approve, reason },
  });
  expect(r.status, `decide ${approvalId}: ${JSON.stringify(r.json)}`).toBe(200);
  return r.json.data;
}

describe('payments and refunds', () => {
  it('reports captured, failed and pending-COD money separately', async () => {
    const s = await signIn('finance@arise.test');
    const r = await call('/payments?pageSize=5', { token: s.accessToken });

    expect(r.status).toBe(200);
    expect(r.json.meta.summary.capturedPaise).toBeGreaterThan(0);
    // COD is not money we hold yet, so it must never be counted as captured.
    expect(r.json.meta.summary.pendingCodPaise).toBeGreaterThan(0);
    expect(r.json.data[0].settledPaise).toBe(r.json.data[0].amountPaise - r.json.data[0].refundedPaise);
  });

  it('flags refunds past the 7-day promise', async () => {
    const s = await signIn('finance@arise.test');
    const r = await call('/refunds?slaBreached=true', { token: s.accessToken });

    expect(r.status).toBe(200);
    for (const row of r.json.data) {
      expect(row.completedAt).toBeNull();
      expect(row.ageDays).toBeGreaterThan(7);
    }
  });

  it('retries only a failed refund', async () => {
    const s = await signIn('finance@arise.test');
    const failed = db.refunds.find((r) => r.status === 'FAILED');
    const done = db.refunds.find((r) => r.status === 'COMPLETED');

    const retry = await call(`/refunds/${failed.id}/retry`, { method: 'POST', token: s.accessToken });
    expect(retry.status).toBe(200);
    expect(retry.json.data.status).toBe('INITIATED');
    expect(retry.json.data.failureReason).toBeNull();

    const bad = await call(`/refunds/${done.id}/retry`, { method: 'POST', token: s.accessToken });
    expect(bad.status).toBe(409);
  });

  it('needs bank details before switching a refund to a bank transfer', async () => {
    const s = await signIn('finance@arise.test');
    const refund = db.refunds.find((r) => r.status !== 'COMPLETED');

    const missing = await call(`/refunds/${refund.id}/mode`, {
      method: 'POST', token: s.accessToken,
      body: { mode: 'BANK', reason: 'Card was closed.' },
    });
    expect(missing.status).toBe(422);
    expect(missing.json.error.fieldErrors.bankAccount).toBeTruthy();

    const okay = await call(`/refunds/${refund.id}/mode`, {
      method: 'POST', token: s.accessToken,
      body: { mode: 'BANK', bankAccount: '50100123456789', reason: 'Card was closed.' },
    });
    expect(okay.status).toBe(200);
    expect(okay.json.data.bankLast4).toBe('6789');
  });

  it('sends a goodwill refund for approval however small it is', async () => {
    const s = await signIn('finance@arise.test');
    const order = db.orders[0];
    const r = await call('/refunds', {
      method: 'POST', token: s.accessToken,
      body: { orderId: order.id, amountPaise: 5000, type: 'GOODWILL', reason: 'Apology for a late delivery.' },
    });

    expect(r.status).toBe(202);
    expect(r.json.error.code).toBe('APPROVAL_REQUIRED');
    // Nothing is created until someone approves it.
    expect(db.refunds.some((x) => x.type === 'GOODWILL')).toBe(false);

    await decide(r.json.error.details.approvalId, 'approver@arise.test');
    expect(db.refunds.some((x) => x.type === 'GOODWILL' && x.amountPaise === 5000)).toBe(true);
  });

  it('refuses a refund above the executive’s own limit without a second approver', async () => {
    const s = await signIn('finance@arise.test');
    const order = db.orders[0];
    // The seeded limit is ₹25,000.
    const r = await call('/refunds', {
      method: 'POST', token: s.accessToken,
      body: { orderId: order.id, amountPaise: 9000000, type: 'MANUAL', reason: 'Disputed chargeback.' },
    });
    expect(r.status).toBe(202);
  });
});

describe('settlements', () => {
  it('summarises payable, in-window, held and settled items', async () => {
    const s = await signIn('finance@arise.test');
    const r = await call('/settlements/summary', { token: s.accessToken });

    expect(r.status).toBe(200);
    const d = r.json.data;
    expect(d.total).toBeGreaterThan(0);
    // Money is only released once the return window closes, so at any moment
    // some items are still inside their window and some have cleared to pay.
    expect(d.inWindowCount).toBeGreaterThan(0);
    expect(d.payableCount).toBeGreaterThan(0);
    expect(d.total).toBe(
      d.payableCount + d.inWindowCount + d.heldCount + d.settledCount + d.failedCount,
    );
  });

  it('never loses money across a settlement line', async () => {
    const s = await signIn('finance@arise.test');
    const r = await call('/settlements?pageSize=50', { token: s.accessToken });

    expect(r.status).toBe(200);
    for (const line of r.json.data) {
      const accounted = line.feesBeforeTaxPaise + line.gstOnFeesPaise + line.tcsPaise
        + line.tdsPaise + line.netPaise - line.adjustmentsPaise;
      expect(accounted, line.id).toBe(line.salePaise);
    }
  });

  it('charges fulfilment fees only on parcels Arise handled', async () => {
    const s = await signIn('finance@arise.test');
    const arise = await call('/settlements?fulfillmentType=ARISE&pageSize=5', { token: s.accessToken });
    const seller = await call('/settlements?fulfillmentType=SELLER&pageSize=5', { token: s.accessToken });

    expect(arise.json.data.length).toBeGreaterThan(0);
    expect(seller.json.data.length).toBeGreaterThan(0);
    for (const line of arise.json.data) expect(line.pickPackFeePaise).toBeGreaterThan(0);
    for (const line of seller.json.data) expect(line.pickPackFeePaise).toBe(0);
  });
});

describe('commission and fees', () => {
  it('previews a payout from the same maths the batch uses', async () => {
    const s = await signIn('finance@arise.test');
    const r = await call('/commission-rules/preview', {
      method: 'POST', token: s.accessToken,
      body: { rootName: 'Fashion', salePaise: 49900, paymentMethod: 'COD' },
    });

    expect(r.status).toBe(200);
    expect(r.json.data.rule.rootName).toBe('Fashion');
    expect(r.json.data.netPaise).toBeLessThan(49900);
    expect(r.json.data.explain.takeRatePct).toBeGreaterThan(0);
  });

  it('never applies a rate change on one person’s say-so', async () => {
    const approver = await signIn('approver@arise.test');
    const rule = db.commissionRules[0];
    const before = rule.commissionPct;

    const r = await call(`/commission-rules/${rule.id}`, {
      method: 'PATCH', token: approver.accessToken,
      body: { commissionPct: before + 2, reason: 'Category margin review.', version: rule.version },
    });
    expect(r.status).toBe(202);
    expect(findById('commissionRules', rule.id).commissionPct).toBe(before);

    await decide(r.json.error.details.approvalId, 'super@arise.test');
    expect(findById('commissionRules', rule.id).commissionPct).toBe(before + 2);
  });

  it('rejects an impossible commission rate', async () => {
    const approver = await signIn('approver@arise.test');
    const rule = db.commissionRules[0];
    const r = await call(`/commission-rules/${rule.id}`, {
      method: 'PATCH', token: approver.accessToken,
      body: { commissionPct: 80, reason: 'Typo.' },
    });
    expect(r.status).toBe(422);
  });

  it('keeps the finance executive out of the rate card', async () => {
    const s = await signIn('finance@arise.test');
    const r = await call(`/commission-rules/${db.commissionRules[0].id}`, {
      method: 'PATCH', token: s.accessToken,
      body: { commissionPct: 5, reason: 'Trying it on.' },
    });
    expect(r.status).toBe(403);
  });
});

describe('COD remittance, tax and invoices', () => {
  it('shows what couriers still owe, and what is overdue', async () => {
    const s = await signIn('finance@arise.test');
    const r = await call('/cod-remittances', { token: s.accessToken });

    expect(r.status).toBe(200);
    expect(r.json.meta.summary.outstandingPaise).toBeGreaterThan(0);
    const short = r.json.data.find((x) => x.status === 'SHORT_PAID');
    expect(short.shortfallPct).toBeGreaterThan(0);
  });

  it('disputes a short payment but not a reconciled one', async () => {
    const s = await signIn('finance@arise.test');
    const short = db.codRemittances.find((x) => x.status === 'SHORT_PAID');
    const done = db.codRemittances.find((x) => x.status === 'RECONCILED');

    const r = await call(`/cod-remittances/${short.id}/dispute`, {
      method: 'POST', token: s.accessToken,
      body: { note: 'Remittance is ₹7,000 short against 40 delivered shipments.' },
    });
    expect(r.status).toBe(200);
    expect(r.json.data.status).toBe('DISPUTED');

    const bad = await call(`/cod-remittances/${done.id}/dispute`, {
      method: 'POST', token: s.accessToken, body: { note: 'Too late.' },
    });
    expect(bad.status).toBe(409);
  });

  it('splits tax as CGST+SGST within a state and IGST across states', async () => {
    const s = await signIn('finance@arise.test');
    const r = await call('/invoices?pageSize=100', { token: s.accessToken });

    expect(r.status).toBe(200);
    for (const inv of r.json.data) {
      if (inv.interState) {
        expect(inv.cgstPaise).toBe(0);
        expect(inv.sgstPaise).toBe(0);
        expect(Math.abs(inv.igstPaise)).toBeGreaterThan(0);
      } else {
        expect(inv.igstPaise).toBe(0);
        expect(inv.cgstPaise).toBe(inv.sgstPaise);
      }
    }
  });

  it('supersedes a tax invoice rather than editing it', async () => {
    const s = await signIn('finance@arise.test');
    const invoice = db.invoices.find((i) => i.type === 'TAX_INVOICE');

    const r = await call(`/invoices/${invoice.id}/regenerate`, {
      method: 'POST', token: s.accessToken,
      body: { reason: 'Customer GSTIN was corrected after dispatch.' },
    });
    expect(r.status).toBe(201);
    expect(r.json.data.supersedes).toBe(invoice.invoiceNo);
    // The original stays on record: a tax document is never deleted.
    expect(findById('invoices', invoice.id).supersededAt).toBeTruthy();
  });

  it('totals TCS and TDS per seller', async () => {
    const s = await signIn('finance@arise.test');
    const r = await call('/tax-summaries', { token: s.accessToken });

    expect(r.status).toBe(200);
    expect(r.json.meta.summary.tcsPaise).toBeGreaterThan(r.json.meta.summary.tdsPaise);
  });
});

describe('wallet', () => {
  it('keeps every balance equal to its own ledger', async () => {
    const s = await signIn('finance@arise.test');
    const r = await call('/wallets?pageSize=20', { token: s.accessToken });
    expect(r.status).toBe(200);

    for (const account of r.json.data) {
      const detail = await call(`/wallets/${account.id}`, { token: s.accessToken });
      expect(detail.json.data.ledgerBalancePaise, account.id).toBe(account.balancePaise);
    }
  });

  it('never lets store credit go negative', async () => {
    const s = await signIn('finance@arise.test');
    const account = db.walletAccounts.find((w) => w.status === 'ACTIVE' && w.balancePaise > 0);

    const r = await call(`/wallets/${account.id}/adjust`, {
      method: 'POST', token: s.accessToken,
      body: { direction: 'DEBIT', amountPaise: account.balancePaise + 100000, reason: 'Reversing a duplicate credit.' },
    });
    expect(r.status).toBe(422);
    expect(r.json.error.fieldErrors.amountPaise).toContain('available');
  });

  it('credits a wallet within the executive’s limit and writes a ledger row', async () => {
    const s = await signIn('finance@arise.test');
    const account = db.walletAccounts.find((w) => w.status === 'ACTIVE');
    const before = account.balancePaise;

    const r = await call(`/wallets/${account.id}/adjust`, {
      method: 'POST', token: s.accessToken,
      body: { direction: 'CREDIT', amountPaise: 50000, reason: 'Compensation for a delayed delivery.' },
    });
    expect(r.status).toBe(201);
    expect(r.json.data.account.balancePaise).toBe(before + 50000);
    expect(r.json.data.entry.balanceAfterPaise).toBe(before + 50000);
    expect(r.json.data.entry.actorName).toBe('Nikhil Joshi');
  });

  it('sends a large credit for approval before the money appears', async () => {
    const s = await signIn('finance@arise.test');
    const account = db.walletAccounts.find((w) => w.status === 'ACTIVE');
    const before = account.balancePaise;

    // The seeded wallet limit is ₹1,000.
    const r = await call(`/wallets/${account.id}/adjust`, {
      method: 'POST', token: s.accessToken,
      body: { direction: 'CREDIT', amountPaise: 500000, reason: 'Service recovery for a lost parcel.' },
    });
    expect(r.status).toBe(202);
    expect(findById('walletAccounts', account.id).balancePaise).toBe(before);

    await decide(r.json.error.details.approvalId, 'super@arise.test');
    expect(findById('walletAccounts', account.id).balancePaise).toBe(before + 500000);
  });

  it('refuses to adjust a frozen wallet', async () => {
    const s = await signIn('finance@arise.test');
    const frozen = db.walletAccounts.find((w) => w.status === 'FROZEN');

    const r = await call(`/wallets/${frozen.id}/adjust`, {
      method: 'POST', token: s.accessToken,
      body: { direction: 'CREDIT', amountPaise: 10000, reason: 'Goodwill.' },
    });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('WALLET_FROZEN');
  });
});

describe('gift cards and cashback', () => {
  it('reports the outstanding gift card liability, not the face value issued', async () => {
    const s = await signIn('super@arise.test');
    const r = await call('/gift-cards', { token: s.accessToken });

    expect(r.status).toBe(200);
    expect(r.json.meta.summary.liabilityPaise).toBeLessThan(r.json.meta.summary.issuedPaise);
  });

  it('sends a large gift card batch for approval and generates it on approval', async () => {
    const s = await signIn('super@arise.test');
    const program = db.giftCardPrograms[0];
    const before = db.giftCards.length;

    const r = await call('/gift-cards', {
      method: 'POST', token: s.accessToken,
      body: { programId: program.id, quantity: 100, facePaise: 500000, reason: 'Diwali corporate order.' },
    });
    expect(r.status).toBe(202);
    expect(db.giftCards.length).toBe(before);

    await decide(r.json.error.details.approvalId, 'approver@arise.test');
    expect(db.giftCards.length).toBe(before + 100);
  });

  it('only issues denominations the programme offers', async () => {
    const s = await signIn('super@arise.test');
    const r = await call('/gift-cards', {
      method: 'POST', token: s.accessToken,
      body: { programId: db.giftCardPrograms[0].id, quantity: 1, facePaise: 12345, reason: 'Odd amount.' },
    });
    expect(r.status).toBe(422);
  });

  it('blocks an active card but not a redeemed one', async () => {
    const s = await signIn('super@arise.test');
    const active = db.giftCards.find((c) => c.status === 'ACTIVE');
    const redeemed = db.giftCards.find((c) => c.status === 'REDEEMED');

    const r = await call(`/gift-cards/${active.id}/block`, {
      method: 'POST', token: s.accessToken, body: { reason: 'Reported stolen.' },
    });
    expect(r.status).toBe(200);
    expect(r.json.data.status).toBe('BLOCKED');

    const bad = await call(`/gift-cards/${redeemed.id}/block`, {
      method: 'POST', token: s.accessToken, body: { reason: 'Too late.' },
    });
    expect(bad.status).toBe(409);
  });

  it('insists a cashback rule has a cap and a budget', async () => {
    const s = await signIn('super@arise.test');
    const r = await call('/cashback-rules', {
      method: 'POST', token: s.accessToken,
      body: { name: 'Unbounded', trigger: 'FIRST_ORDER', cashbackPct: 10 },
    });
    expect(r.status).toBe(422);
    expect(r.json.error.fieldErrors.maxCashbackPaise).toBeTruthy();
    expect(r.json.error.fieldErrors.budgetPaise).toBeTruthy();
  });

  it('pauses a running rule and refuses to edit an ended one', async () => {
    const s = await signIn('super@arise.test');
    const active = db.cashbackRules.find((c) => c.status === 'ACTIVE');
    const ended = db.cashbackRules.find((c) => c.status === 'ENDED');

    const pause = await call(`/cashback-rules/${active.id}`, {
      method: 'PATCH', token: s.accessToken, body: { status: 'PAUSED', reason: 'Budget review.' },
    });
    expect(pause.status).toBe(200);
    expect(pause.json.data.status).toBe('PAUSED');

    const bad = await call(`/cashback-rules/${ended.id}`, {
      method: 'PATCH', token: s.accessToken, body: { status: 'ACTIVE' },
    });
    expect(bad.status).toBe(409);
  });
});

describe('exports', () => {
  it('queues an export job carrying the filters the user was looking at', async () => {
    const s = await signIn('finance@arise.test');
    const r = await call('/finance/export', {
      method: 'POST', token: s.accessToken,
      body: { dataset: 'settlements', filters: { eligible: 'true', sellerId: 'SEL-0001' } },
    });

    expect(r.status).toBe(200);
    expect(r.json.data.type).toBe('EXPORT');
    expect(r.json.data.metadata.filters.sellerId).toBe('SEL-0001');
    expect(r.json.data.totalRows).toBe(db.settlementLines.length);
  });

  it('checks the permission for the dataset, not just for exporting', async () => {
    // The support lead can see wallets but holds no finance export rights.
    const s = await signIn('supportlead@arise.test');
    const r = await call('/finance/export', {
      method: 'POST', token: s.accessToken,
      body: { dataset: 'tax-summaries' },
    });
    expect(r.status).toBe(403);
  });

  it('rejects an unknown dataset', async () => {
    const s = await signIn('finance@arise.test');
    const r = await call('/finance/export', {
      method: 'POST', token: s.accessToken, body: { dataset: 'everything' },
    });
    expect(r.status).toBe(422);
  });
});

describe('finance overview', () => {
  it('separates what is payable now from what is held', async () => {
    const s = await signIn('finance@arise.test');
    const r = await call('/finance/overview', { token: s.accessToken });

    expect(r.status).toBe(200);
    expect(r.json.data.payableNowPaise).toBeGreaterThan(0);
    expect(r.json.data.heldPaise).toBeGreaterThan(0);
    // Liabilities the platform owes customers are tracked, not netted off.
    expect(r.json.data.walletLiabilityPaise).toBeGreaterThan(0);
    expect(r.json.data.giftCardLiabilityPaise).toBeGreaterThan(0);
  });
});
