# ADR-002: Wallet, store credit, referrals, and promotions

Status: Accepted  
Date: 2026-11-04

## Decision

The v1 wallet is a non-withdrawable store-credit ledger. It is not a bank account, prepaid payment
instrument, peer-to-peer wallet, or cash top-up facility.

- Customers cannot add money, send credit, scan to pay, or withdraw.
- Credits arise from approved refunds, goodwill adjustments, gift-card redemption, or referral
  rewards.
- Every balance change is an immutable ledger entry. The balance is derived server-side.
- Credit lots may expire. Debit allocation consumes the earliest-expiring eligible lot first.
- Refunds return to the original source unless backend policy explicitly permits store credit.
- Gift-card redemption and referral reward issuance require idempotency keys.

Coupons and promotions are server-owned resources with eligibility, stacking, funding, usage limits,
validity, and seller/category scope. The cart and checkout response is authoritative for whether a
promotion was applied and for its monetary effect.

## Consequences

The customer app displays wallet summary and ledger, redeems gift cards, and shares server-generated
referral links. It does not calculate balances, cashback, eligibility, expiry, or coupon discounts.
