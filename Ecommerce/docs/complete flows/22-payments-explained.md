# Payments Explained

## What Is This?

Money is the backbone of any commerce platform. This document explains every payment method, how money moves between parties, and what happens when payments fail or need to be refunded.

---

## Who Should Read This?

Anyone who needs to understand how money flows through the platform — business owners, operations staff, and anyone rebuilding a similar system.

---

## Payment Methods

The platform supports three ways for customers to pay:

### 1. Online Payment

Customer pays through a payment partner (UPI, credit/debit card, net banking, or digital wallets like Paytm, PhonePe).

### 2. Cash on Delivery (COD)

Customer pays the delivery partner in physical cash at the doorstep.

### 3. Wallet

Customer uses stored balance in their platform wallet. Can be combined with online payment or COD.

---

## Online Payment Flow

### Step-by-step

1. Customer chooses "Pay Online" at checkout
2. Customer places order — system creates order in "waiting for payment" status
3. Customer is redirected to the payment partner's secure page
4. Customer completes payment (UPI, card, etc.)
5. Payment partner confirms the transaction
6. Customer is redirected back to the platform's payment status page
7. System verifies payment with payment partner
8. Order advances to "waiting for seller"

### Double confirmation

Payment is confirmed two ways for safety:

- **Customer callback** — when customer returns from payment page
- **Server notification** — payment partner sends confirmation directly to the platform server

This prevents fake payment claims.

### If payment fails

- Customer sees failure message on payment status page
- Customer can retry payment
- If not retried within timeout, order is cancelled
- No money is charged

---

## Cash on Delivery Flow

### Step-by-step

1. Customer chooses "Cash on Delivery" at checkout
2. Customer places order — no payment step
3. Order goes directly to seller
4. Full delivery happens as normal
5. At the doorstep, rider collects cash from customer
6. Rider confirms cash collected in their app
7. Cash is recorded as "cash in hand" on rider's account
8. Rider eventually submits cash to the platform
9. Admin reconciles the cash against the order

### COD amount

The exact cash amount is shown on the rider's screen — includes item total, delivery fee, taxes, minus any wallet or coupon deductions.

---

## Wallet Payment

### Full wallet payment

If wallet balance covers the entire order total:

- No online payment or COD needed
- Wallet is debited at checkout
- Order proceeds directly to seller

### Partial wallet payment

If wallet covers part of the total:

- Wallet amount deducted at checkout
- Remaining amount paid online or via COD

### Wallet rules

- Wallet money comes from refunds, promotions, or admin credits
- Cannot be withdrawn to a bank account
- Only usable within the platform

---

## Payment Statuses (Plain Language)

| Status         | Meaning                              |
| -------------- | ------------------------------------ |
| Created        | Order placed, payment not yet made   |
| Pending        | Online payment in progress           |
| Paid           | Payment successful                   |
| Failed         | Payment did not go through           |
| Cash collected | Rider collected COD from customer    |
| Cash remitted  | Rider submitted COD cash to platform |
| Reconciled     | COD fully accounted for              |
| Refunded       | Money returned to customer           |

---

## Refund Paths

### When refunds happen

| Situation                        | Refund method                     |
| -------------------------------- | --------------------------------- |
| Order cancelled before delivery  | Wallet or original payment method |
| Seller did not accept            | Auto-refund                       |
| No rider found                   | Auto-refund                       |
| Return completed                 | Wallet or original payment method |
| Payment charged but order failed | Auto-refund                       |

### Refund timing

- Wallet refunds: usually instant
- Payment method refunds: 3–7 business days depending on bank

---

## Money Settlement on Delivery

When an order is successfully delivered, the total payment is split:

| Party    | Share                           | When available                          |
| -------- | ------------------------------- | --------------------------------------- |
| Seller   | Item price minus commission     | Pending → available after return window |
| Rider    | Delivery fee plus tip           | Immediately                             |
| Platform | Commission, platform fee, taxes | Immediately                             |

---

## COD Cash Chain

```
Customer pays cash to rider
        ↓
Rider's "cash in hand" increases
        ↓
Rider submits cash to platform (via app or physically)
        ↓
Admin records settlement
        ↓
Cash reconciled against orders
        ↓
Seller earnings paid from platform funds
```

---

## Preventing Double Charges

The system has safeguards against charging customers twice:

- Each checkout has a unique identifier
- If customer taps "Place Order" multiple times, only one order is created
- Payment partner transactions are matched to specific orders
- Duplicate payment confirmations are ignored

---

## What If Something Goes Wrong?

| Problem                                | What happens                                  |
| -------------------------------------- | --------------------------------------------- |
| Payment succeeds but order not created | Auto-refund triggered                         |
| Customer charged wrong amount          | Support investigates; manual refund if needed |
| COD rider collects wrong amount        | Rider should not confirm; contact support     |
| Refund not received                    | Check wallet first; payment refunds take days |
| Wallet balance wrong                   | Support checks transaction history            |

---

_Next → [Notifications and Alerts](23-notifications-and-alerts.md)_
