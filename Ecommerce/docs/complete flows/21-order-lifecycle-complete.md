# Complete Order Lifecycle

## What Is This?

This is the master document that tells the full story of an order — from the moment a customer taps "Place Order" to the moment money is settled and the return window closes. Every person involved and every automatic system action is explained here.

---

## Who Should Read This?

Everyone — it is the single best document to understand how the whole platform works together.

---

## The Full Journey

### Phase 1: Order Placement

**Who:** Customer

1. Customer reviews cart and checkout page
2. Customer selects address, payment method, applies coupon/wallet
3. Customer taps "Place Order"
4. System calculates final price (preview confirmed)
5. System creates the order

**What the system does:**

- Reserves stock for all items
- Deducts wallet amount if used
- Creates order record(s) — one per shop if multi-shop
- For online payment: redirects customer to payment partner
- For COD: skips payment step

---

### Phase 2: Payment (Online Only)

**Who:** Customer, payment partner

1. Customer pays on payment partner's page
2. Payment partner confirms success
3. Customer returns to payment status page
4. System records payment and advances order

**If payment fails:**

- Order stays in "waiting for payment"
- Customer can retry or order auto-cancels after timeout
- No money charged

---

### Phase 3: Seller Acceptance

**Who:** Seller

1. Seller receives instant notification (popup/sound)
2. Seller sees order details and 60-second countdown
3. Seller taps "Accept"

**If seller accepts:**

- Order moves to "confirmed" — seller starts preparing

**If seller does NOT accept within ~60 seconds:**

- Order auto-cancelled
- Customer notified and refunded
- Stock released

---

### Phase 4: Preparation

**Who:** Seller

1. Seller gathers and packs items
2. Seller taps "Ready for Pickup"
3. System starts searching for a delivery partner

---

### Phase 5: Delivery Partner Search

**Who:** System (automatic), delivery partners

1. System broadcasts job to nearby online riders
2. Riders see job details (shop, address, earnings)
3. A rider taps "Accept"

**If rider accepts:**

- Order assigned to that rider
- Other riders no longer see the job

**If no rider accepts within ~60 seconds:**

- System expands search radius and retries (up to 3 attempts)
- If still no rider: order may be cancelled and customer refunded

---

### Phase 6: Pickup

**Who:** Delivery partner, seller

1. Rider navigates to shop
2. Rider taps "Arrived at Shop"
3. Seller hands over packed order
4. Rider taps "Pickup Complete"
5. Order status: "Out for Delivery"
6. Customer notified — tracking map activates

---

### Phase 7: Delivery

**Who:** Delivery partner, customer

1. Rider navigates to customer address
2. Customer sees rider on live map
3. Rider arrives and requests delivery code
4. Customer shares code from their order page
5. Rider enters code
6. For COD: rider collects cash from customer
7. Rider taps "Delivery Complete"
8. Order status: "Delivered"

---

### Phase 8: Settlement

**Who:** System (automatic)

When delivery is confirmed, money is distributed:

| Party    | What they get                                      |
| -------- | -------------------------------------------------- |
| Seller   | Item earnings minus commission (marked as pending) |
| Rider    | Delivery fee plus tip                              |
| Platform | Commission plus fees                               |
| Customer | Order complete — can review products               |

**COD specific:** Cash collected by rider is recorded as "cash in hand."

---

### Phase 9: Return Window

**Who:** Customer (optional), system (automatic)

- A timer starts after delivery (configured duration, e.g., 30 minutes to a few hours)
- During this window, customer can request a return
- If no return requested: seller's pending earnings move to available balance
- If return requested: see Phase 10

---

### Phase 10: Return (If Requested)

**Who:** Customer, seller, delivery partner, admin

1. Customer requests return with items and reason
2. Seller approves or rejects
3. Admin may do quality check
4. Return rider assigned for pickup
5. Rider picks up from customer (pickup code)
6. Rider delivers to shop (drop code)
7. Refund credited to customer
8. Seller's earnings for that order reversed

---

## Order Status Map

| Stage            | Customer sees               | Seller sees           | Rider sees            |
| ---------------- | --------------------------- | --------------------- | --------------------- |
| Order placed     | "Pending"                   | "New order — accept!" | —                     |
| Payment pending  | "Processing payment"        | —                     | —                     |
| Seller preparing | "Confirmed"                 | "Preparing"           | —                     |
| Finding rider    | "Finding delivery partner"  | "Waiting for rider"   | Job offer             |
| Rider assigned   | "Delivery partner assigned" | "Rider on the way"    | "Go to shop"          |
| Out for delivery | "Out for delivery" + map    | "Being delivered"     | "Deliver to customer" |
| Delivered        | "Delivered"                 | "Delivered"           | "Completed"           |
| Cancelled        | "Cancelled" + refund        | "Cancelled"           | —                     |

---

## Notifications at Each Stage

| Event                 | Customer | Seller | Rider | Admin    |
| --------------------- | -------- | ------ | ----- | -------- |
| Order placed          | Yes      | Yes    | —     | Optional |
| Payment confirmed     | Yes      | —      | —     | —        |
| Seller accepted       | Yes      | —      | —     | —        |
| Seller timeout/cancel | Yes      | —      | —     | —        |
| Rider assigned        | Yes      | Yes    | —     | —        |
| Out for delivery      | Yes      | —      | —     | —        |
| Delivered             | Yes      | Yes    | Yes   | —        |
| Return requested      | —        | Yes    | —     | —        |
| New delivery job      | —        | —      | Yes   | —        |

---

## Money Flow Summary

```
Customer pays (online/COD/wallet)
        ↓
Platform receives total
        ↓
    ┌───────────────────────────────────┐
    │  Seller share (minus commission)  │ → Pending → Available (after return window)
    │  Rider share (fee + tip)          │ → Available immediately
    │  Platform share (commission + fees)│ → Admin wallet
    └───────────────────────────────────┘
```

---

## Multi-Shop Order Lifecycle

When a customer orders from two shops in one checkout:

- **One checkout, two independent order lifecycles**
- Each shop gets its own order notification and accept timer
- Each shop may get a different rider
- Customer tracks each order separately
- Each order settles independently
- Returns handled per shop order

---

## Cancellation Points

An order can be cancelled at several points:

| When                            | Who cancels | Refund      |
| ------------------------------- | ----------- | ----------- |
| Payment fails                   | System      | No charge   |
| Seller timeout                  | System      | Full refund |
| No rider found                  | System      | Full refund |
| Customer requests (early stage) | Customer    | Full refund |
| Admin intervention              | Admin       | As decided  |

After rider picks up the order, cancellation is generally not possible.

---

## What If Something Goes Wrong?

| Problem                           | System response                         |
| --------------------------------- | --------------------------------------- |
| Payment charged, order fails      | Auto-refund to wallet or payment method |
| Seller accepts but cannot fulfill | Admin cancels; customer refunded        |
| Rider accepts but cannot deliver  | Admin reassigns or cancels              |
| Wrong delivery code entered       | Delivery not confirmed; rider retries   |
| Return disputed                   | Admin reviews and decides               |

---

_This is the most important document in the library. Read it first if you want to understand the whole system._

_Next → [Payments Explained](22-payments-explained.md)_
