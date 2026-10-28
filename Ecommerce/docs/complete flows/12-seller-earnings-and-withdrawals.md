# Seller Earnings and Withdrawals

## What Is This?

Sellers earn money from every delivered order. This document explains how earnings are calculated, when money becomes available, how the seller wallet works, and how to withdraw earnings to a bank account.

---

## Who Uses This?

**Approved sellers** tracking their income and requesting payouts.

---

## What Can You Do?

- View earnings per order and in total
- See pending vs available balance
- View wallet transaction history
- Request withdrawal to bank account
- View sales analytics and trends

---

## How Sellers Earn Money

### Per order

When a customer order is delivered successfully:

1. Customer pays the total (online, COD, or wallet)
2. System calculates seller's share:
   - Item total minus platform commission
3. Seller's share is credited to their wallet
4. Money is initially marked as **pending**

### Platform commission

The platform takes a percentage of each sale as commission. This is deducted before crediting the seller. The commission rate is configured by admin.

### Example

- Customer pays ₹1,000 for items
- Platform commission: 10% (₹100)
- Seller earns: ₹900

---

## Pending vs Available Balance

### Pending balance

Money from recent deliveries that is **on hold**. This protects against returns — if a customer returns an order, the seller's earnings for that order may be reversed.

### Available balance

Money that has passed the **return window** (configured time after delivery, e.g., 30 minutes to a few hours). This money is free to withdraw.

### How money moves from pending to available

- Automatically, after the return window closes with no return request
- If customer requests a return and it is completed, pending money for that order is reversed

---

## Seller Wallet

### What is it?

A digital account tracking all of the seller's money on the platform.

### Transaction history

Every credit and debit is recorded:

- **Credits** — earnings from delivered orders
- **Debits** — withdrawals, commission, return reversals

### Viewing the wallet

Seller portal shows:

- Total balance
- Pending amount
- Available amount
- Full transaction list with dates and descriptions

---

## Withdrawals

### How to withdraw

1. Seller goes to Withdrawals page
2. Seller enters amount to withdraw (up to available balance)
3. Seller submits withdrawal request
4. Request goes to admin for processing
5. Admin approves and processes the bank transfer
6. Seller sees status update: pending → processed

### Withdrawal status

| Status    | Meaning                              |
| --------- | ------------------------------------ |
| Pending   | Request submitted, waiting for admin |
| Processed | Money transferred to seller's bank   |
| Rejected  | Request denied (with reason)         |

### Rules

- Can only withdraw from **available** balance (not pending)
- Minimum withdrawal amount may apply
- Bank details must be set up in seller profile
- Processing may take 1–3 business days

---

## Analytics

The seller analytics page shows:

- **Sales over time** — daily, weekly, monthly charts
- **Top selling products** — which items sell most
- **Order trends** — number of orders over time
- **Revenue summary** — total earnings for selected period

Useful for understanding business performance and planning inventory.

---

## Transactions Page

A detailed list of all financial transactions — every order earning, commission deduction, withdrawal, and return reversal. Sellers can filter by date and type.

---

## What Happens Behind the Scenes

- Earnings are calculated automatically at delivery confirmation
- Return window timer runs in the background — when it expires, pending money moves to available
- If a return is completed, the system reverses the seller's earning for that order
- Withdrawal requests are queued for admin processing
- All money movements are recorded in a permanent ledger

---

## Important Rules

- Earnings only credited after successful delivery (not at order placement)
- Commission is deducted automatically — seller sees net earnings
- Pending money cannot be withdrawn until return window passes
- Return on a delivered order may reverse seller's earning
- Withdrawal requires admin approval and processing

---

## What If Something Goes Wrong?

| Problem                  | What happens                                         |
| ------------------------ | ---------------------------------------------------- |
| Earnings not showing     | Wait until delivery is confirmed; check order status |
| Balance seems wrong      | Check transaction history; contact admin             |
| Withdrawal delayed       | Admin processing may take a few days                 |
| Return reversed earnings | Normal — return completed means earning is reversed  |
| Wrong bank details       | Update in profile before next withdrawal             |

---

_Next → [Delivery Partner Onboarding](13-delivery-partner-onboarding.md)_
