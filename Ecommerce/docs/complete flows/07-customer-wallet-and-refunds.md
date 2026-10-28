# Customer Wallet and Refunds

## What Is This?

The customer wallet is a digital money account inside the platform. Customers can store balance from refunds and promotions, use it to pay for orders, and view their full transaction history. This document also explains how refunds and returns work from the customer's perspective.

---

## Who Uses This?

**Customers** who have wallet balance or want to understand refunds.

---

## What Can You Do?

- View wallet balance
- See full transaction history (money in and money out)
- Use wallet balance at checkout to pay for orders
- Receive refunds from cancelled orders or approved returns

---

## The Customer Wallet

### What is it?

A digital account linked to the customer's profile. It holds money that belongs to the customer and can be used within the platform.

### Where does wallet money come from?

- **Refunds** from cancelled orders
- **Refunds** from approved returns
- **Promotional credits** added by admin
- **Failed payment compensation** — if payment was charged but order failed

### Where can wallet money be used?

- **At checkout** — full or partial payment for new orders
- Wallet cannot be withdrawn to a bank account (it is platform credit only)

---

## Viewing Wallet Balance

On the wallet page, customers see:

- **Current balance** — how much money is available right now
- **Transaction history** — every credit and debit with date, amount, and reason

### Transaction types customer might see

| Type           | Meaning                                           |
| -------------- | ------------------------------------------------- |
| Credit         | Money added (refund, promotion)                   |
| Debit          | Money used (paid for an order)                    |
| Order refund   | Money returned from a cancelled or returned order |
| Wallet payment | Wallet used at checkout                           |

---

## Using Wallet at Checkout

1. Customer goes to checkout with items in cart
2. If wallet has balance, checkout page shows wallet section
3. Customer chooses how much wallet balance to use
4. Wallet amount is subtracted from the grand total
5. If wallet covers the full amount, no online payment needed
6. If wallet covers part, customer pays the remainder online or via COD

### Example

- Order total: ₹500
- Wallet balance: ₹200
- Customer uses ₹200 from wallet
- Remaining to pay: ₹300 (online or COD)

---

## Refunds

### When do refunds happen?

| Situation                              | Refund          |
| -------------------------------------- | --------------- |
| Customer cancels order (allowed stage) | Yes             |
| Shop does not accept in time           | Yes (automatic) |
| No delivery partner found              | Yes (automatic) |
| Online payment fails                   | No charge made  |
| Return approved and completed          | Yes             |
| Payment charged but order failed       | Yes (automatic) |

### Where does the refund go?

- **Online payments** — usually refunded to wallet first; may go back to original payment method depending on configuration
- **Wallet payments** — returned to wallet
- **COD orders** — no payment was made, so no refund needed (unless wallet was partially used)

### How long do refunds take?

- Wallet refunds are usually instant
- Payment method refunds may take a few business days depending on the bank or payment partner

---

## Return and Refund Flow

### Return window

After delivery, customers have a limited time to request a return (configured by admin, e.g., 30 minutes to a few hours). After this window closes, returns are not accepted.

### Step-by-step return process

1. **Customer requests return**
   - Opens delivered order
   - Selects items and reason
   - Submits return request

2. **Seller reviews**
   - Seller approves or rejects with a reason
   - Customer is notified of the decision

3. **Quality check (if required)**
   - Admin may inspect the return request before proceeding

4. **Pickup arranged**
   - System assigns a delivery partner to pick up the item from customer
   - Customer receives a pickup code

5. **Rider picks up**
   - Rider comes to customer's address
   - Customer shares pickup code
   - Rider may take a photo as proof

6. **Item returned to shop**
   - Rider delivers item back to the seller
   - Rider verifies drop code at the shop

7. **Refund processed**
   - System credits refund to customer's wallet or payment method
   - Customer is notified

---

## What Happens Behind the Scenes

- Every wallet change is recorded in a transaction log — full history is always available
- Refunds from online payments go through the payment partner's refund process
- Return refunds may wait until the item is confirmed back at the shop
- Seller's earnings for that order may be reversed when a return is completed

---

## Important Rules

- Wallet balance cannot be transferred to another customer
- Wallet balance cannot be withdrawn to a bank account
- Return must be requested within the return window
- Partial returns are possible — customer can return some items, not all
- Refund amount matches what the customer paid for the returned items (including proportional fees if applicable)

---

## What If Something Goes Wrong?

| Problem                      | What happens                                       |
| ---------------------------- | -------------------------------------------------- |
| Refund not showing in wallet | May take a few minutes; contact support if delayed |
| Return rejected by seller    | Customer notified with reason; can contact support |
| Wrong refund amount          | Contact support with order details                 |
| Wallet balance incorrect     | Support can check transaction history and fix      |

---

_Next → [Customer Account and Support](08-customer-account-and-support.md)_
