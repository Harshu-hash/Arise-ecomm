# Admin Finance and Wallets

## What Is This?

Money flows through many hands in a quick commerce platform — customers pay, sellers earn, riders earn, and the platform takes its share. This document explains how admins manage all financial operations: wallets, payouts, cash collection, and financial reporting.

---

## Who Uses This?

**Platform administrators** and finance team managing money across the platform.

---

## What Can You Do?

- View platform revenue and finance summary
- See the complete money ledger
- Process seller and rider withdrawal requests
- Manage COD cash collection from riders
- View and settle transactions
- Export financial statements

---

## Finance Dashboard

### Summary metrics

- Total platform revenue (fees and commissions)
- Total order value processed
- Pending payouts (withdrawals waiting to be processed)
- Total COD cash outstanding (held by riders)
- Wallet balances across all parties

### Charts and trends

- Revenue over time
- Payout volume
- COD collection trends

---

## Money Ledger

A complete record of every financial transaction on the platform:

| Entry type          | Example                                 |
| ------------------- | --------------------------------------- |
| Customer payment    | Customer paid ₹500 online               |
| Seller earning      | Seller credited ₹450 (after commission) |
| Rider earning       | Rider credited ₹40 delivery fee         |
| Platform commission | Platform credited ₹50                   |
| COD collection      | Rider collected ₹500 cash               |
| Cash remittance     | Rider submitted ₹500 cash to platform   |
| Withdrawal          | Seller withdrew ₹5,000 to bank          |
| Refund              | Customer refunded ₹200                  |

Every entry shows: date, amount, parties involved, and reason.

---

## Admin Wallet

The platform's own wallet — holding the business's earnings from commissions, fees, and other charges. Admin can view balance and transaction history.

---

## Payouts

### Seller withdrawals

When sellers request withdrawal of their available earnings:

1. Request appears in admin's withdrawal list
2. Admin reviews amount and seller's bank details
3. Admin processes the bank transfer
4. Status updated to "processed"
5. Seller's wallet balance reduced

### Rider withdrawals

Same process for delivery partner withdrawal requests.

### Bulk processing

Admin can process multiple withdrawal requests at once for efficiency.

---

## Cash Collection Hub

### The COD cash problem

When customers pay cash on delivery, riders hold physical money. The platform needs that money back to pay sellers and cover operations.

### Cash collection dashboard

Shows:

- **Each rider's cash in hand** — how much COD cash they currently hold
- **Total outstanding cash** — sum across all riders
- **Recent collections** — when riders submitted cash

### Settling cash

When a rider hands over collected cash (physically or through the app):

1. Admin opens rider's cash details
2. Admin records the settlement amount
3. Rider's cash in hand decreases
4. Transaction logged in cash history

### Cash history

Complete log of all cash settlements — who submitted, how much, when.

---

## Transaction Management

### Seller transactions

All financial movements for each seller — earnings, commissions, withdrawals, return reversals.

### Delivery transactions

All financial movements for each rider — delivery fees, tips, COD collections, cash submissions, withdrawals.

### Settling transactions

Admin can mark individual transactions as settled — useful for reconciliation with bank statements.

### Bulk settle

Process multiple delivery transactions at once.

---

## Delivery Funds

Overview of all delivery-related financial activity:

- Total delivery fees paid to riders
- Total tips distributed
- COD amounts collected and remitted
- Outstanding cash with riders

---

## Export Statements

Admin can export financial data for accounting:

- Date range selection
- Filter by transaction type, seller, or rider
- Download as spreadsheet for accountants

---

## What Happens Behind the Scenes

- Every money movement creates a ledger entry — nothing happens without a record
- Seller earnings move from pending to available after return window
- COD cash is tracked separately from rider earnings
- Withdrawal processing is manual (admin approves) for security
- Background jobs periodically verify that wallet balances match ledger records

---

## Important Rules

- Every rupee must be accounted for in the ledger
- COD cash must be collected from riders regularly
- Withdrawals only from available balance (not pending or cash in hand)
- Refunds reduce the appropriate party's balance
- Financial exports should be done regularly for accounting compliance

---

## What If Something Goes Wrong?

| Problem                              | What to do                                      |
| ------------------------------------ | ----------------------------------------------- |
| Wallet balance does not match ledger | Run verification check; investigate discrepancy |
| Rider not submitting cash            | Contact rider; restrict new jobs if needed      |
| Withdrawal to wrong bank account     | Verify bank details before processing           |
| Refund not reflected                 | Check ledger; process manual credit if needed   |
| Revenue numbers seem wrong           | Export statement; reconcile with order data     |

---

_Next → [Complete Order Lifecycle](21-order-lifecycle-complete.md)_
