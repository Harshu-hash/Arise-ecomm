# Customer Orders and Tracking

## What Is This?

After placing an order, customers need to see order status, track delivery in real time, share delivery codes, cancel if needed, and request returns. This document covers everything in the customer's order experience.

---

## Who Uses This?

**Customers** who have placed one or more orders.

---

## What Can You Do?

- View all past and active orders
- See detailed information for each order
- Track delivery on a live map
- Share delivery code to confirm receipt
- Cancel an order (when allowed)
- Request a return on delivered orders
- View order transaction history

---

## Order List Page

Customers see all their orders in one place, usually sorted with newest first.

### Order status labels (what customer sees)

| Status           | What it means                            |
| ---------------- | ---------------------------------------- |
| Pending          | Order placed, waiting for shop to accept |
| Confirmed        | Shop accepted and preparing              |
| Out for delivery | Rider is on the way to customer          |
| Delivered        | Order completed successfully             |
| Cancelled        | Order was cancelled                      |
| Returned         | Return process completed                 |

Each order card shows: order number, date, items summary, total amount, and current status.

---

## Order Detail Page

Tapping an order opens the full detail view:

### Information shown

- Order number and date
- All items with quantities and prices
- Full price breakdown (items, fees, discount, tip, total)
- Payment method (online or cash on delivery)
- Delivery address
- Shop name(s)
- Assigned delivery partner (when applicable)

### Progress tracker

A visual step-by-step indicator showing where the order is:

1. **Order placed** — checkout complete
2. **Shop preparing** — seller accepted and packing
3. **Finding delivery partner** — system searching for nearby rider
4. **Delivery partner assigned** — rider heading to shop
5. **Out for delivery** — rider heading to customer
6. **Delivered** — order complete

The current step is highlighted. Completed steps show a checkmark.

---

## Live Delivery Tracking

When a rider is on the way, the customer sees a **live map** on the order detail page.

### What the map shows

- Rider's current position (updates automatically in real time)
- Route from shop to customer's address
- Estimated progress along the route

### How it works (behind the scenes)

- Rider's phone sends location updates while delivering
- Live location service stores the position
- Customer's map refreshes without the customer doing anything
- Tracking ends when delivery is confirmed

Customer does not need to refresh the page — the map updates on its own.

---

## Delivery Code

When the rider is near the customer's address, a **delivery code** appears on the customer's order page.

### How it works

1. Rider arrives at customer's door
2. Rider requests the delivery code from their app
3. Customer sees the code on their order detail page
4. Customer tells the rider the code (or rider reads it from a notification)
5. Rider enters the code in their app
6. Delivery is confirmed

### Why it exists

The delivery code prevents riders from marking orders as delivered when they have not actually reached the customer. It protects both the customer and the platform.

---

## Cancelling an Order

Customers can cancel orders, but only **before certain stages**.

### When cancellation is allowed

- Before the shop starts preparing (early stages)
- Rules may vary based on platform configuration

### When cancellation is NOT allowed

- After the rider has picked up the order
- After delivery is complete

### What happens on cancellation

| Payment type     | Refund                                              |
| ---------------- | --------------------------------------------------- |
| Online payment   | Money returned to wallet or original payment method |
| Cash on delivery | No payment was made — order simply cancelled        |
| Wallet used      | Wallet amount restored                              |
| Coupon used      | Coupon may be restored depending on rules           |

Stock is released back to the shop.

---

## Return Request Flow

After delivery, customers can request a return within a **return window** (configured time period after delivery, e.g., 30 minutes).

### Step-by-step

1. Customer opens a delivered order
2. Customer taps "Request Return"
3. Customer selects which items to return and provides a reason
4. Request goes to the seller for approval
5. If seller approves, admin may do a quality check
6. A delivery partner is assigned to pick up the item from customer
7. Customer shares a **pickup code** with the rider
8. Rider picks up the item and delivers it back to the shop
9. Rider verifies a **drop code** at the shop
10. Refund is credited to customer's wallet or payment method

See [Customer Wallet and Refunds](07-customer-wallet-and-refunds.md) for refund details.

---

## Order Transaction History

A separate page shows all money movements related to the customer's orders — payments made, refunds received, wallet credits. Useful for checking payment history.

---

## What Happens Behind the Scenes

- Order status updates are pushed instantly to the customer's app — no refresh needed
- When seller accepts, customer sees "Shop is preparing"
- When rider is assigned, customer gets a notification
- When rider is nearby, delivery code becomes visible
- When delivery is confirmed, status changes to "Delivered" and tracking map closes

---

## Important Rules

- Each shop in a multi-shop order has its own tracking and status
- Delivery code is unique per order and changes each time
- Return window is time-limited — after it closes, returns are not accepted
- Cancellation refunds may take a few minutes to appear in wallet or bank

---

## What If Something Goes Wrong?

| Problem                             | What happens                                                           |
| ----------------------------------- | ---------------------------------------------------------------------- |
| Shop does not accept in time        | Order auto-cancelled; customer notified and refunded                   |
| No rider found                      | Order may be cancelled or retried with wider search; customer notified |
| Rider cannot find address           | Customer can contact support; rider can call customer                  |
| Wrong items delivered               | Customer can request return within return window                       |
| Payment charged but order cancelled | Automatic refund to wallet or payment method                           |

---

_Next → [Customer Wallet and Refunds](07-customer-wallet-and-refunds.md)_
