# Seller Orders and Fulfillment

## What Is This?

When a customer orders from a shop, the seller must accept, prepare, and hand over the order to a delivery partner. This document explains every step of seller order fulfillment — from receiving a new order alert to confirming pickup.

---

## Who Uses This?

**Approved sellers** receiving and fulfilling customer orders.

---

## What Can You Do?

- View all orders with status filters
- Accept or let orders auto-cancel
- Mark orders as ready for pickup
- Confirm when a rider picks up the order
- Approve or reject customer return requests
- Track delivery progress on a map

---

## Order List

The seller's orders page shows all orders with filters:

| Filter           | Shows                        |
| ---------------- | ---------------------------- |
| All              | Every order                  |
| Pending          | Waiting for seller to accept |
| Confirmed        | Accepted and preparing       |
| Out for delivery | Rider has picked up          |
| Delivered        | Completed                    |
| Cancelled        | Cancelled orders             |
| Returns          | Return requests              |

Each order shows: order number, customer name, items, total, payment type (online or COD), and current status.

---

## Fulfillment Flow

### Step 1: New order alert

- Customer places an order including items from this shop
- Seller's app shows a popup or sound notification
- Order details displayed: items, quantities, customer address, payment type
- **60-second countdown** starts — seller must accept or order auto-cancels

### Step 2: Accept the order

- Seller taps "Accept"
- Order status changes to "confirmed"
- Seller should start preparing/packing the items

### What if seller does not accept?

- After ~60 seconds, order is **automatically cancelled**
- Customer is notified and refunded (if online payment)
- Stock is released back to inventory

### Step 3: Prepare the order

- Seller gathers and packs all items
- Seller verifies items match the order

### Step 4: Mark ready for pickup

- Seller taps "Ready for Pickup"
- System starts searching for a nearby delivery partner
- Another **60-second timer** begins for rider search

### Step 5: Rider assigned

- A nearby online rider accepts the delivery job
- Seller sees rider details (name, phone)
- Rider is heading to the shop

### Step 6: Rider arrives at shop

- Rider confirms arrival at the shop
- Seller hands over the packed order
- Seller confirms pickup is complete in their app

### Step 7: Seller's job is done

- Order leaves the shop with the rider
- Seller can track the rider's progress on a map
- Seller will see "Delivered" when the customer confirms receipt

---

## Returns (Seller Side)

### Receiving return requests

When a customer requests a return on a delivered order:

1. Seller sees the return request in their returns section
2. Seller reviews items and reason
3. Seller **approves** or **rejects** with a reason

### If approved

- Admin may perform a quality check
- A delivery partner is assigned to pick up from customer
- Rider brings item back to the shop
- Seller confirms receipt of returned item
- Refund is processed for the customer

### If rejected

- Customer is notified with the seller's reason
- Customer can contact support if they disagree

---

## Delivery Tracking

For active orders, seller can view a map showing:

- Rider's current location
- Route from shop to customer
- Delivery progress

This helps the seller know when the order is delivered without calling the rider.

---

## What Happens Behind the Scenes

- New order notification is instant — pushed to seller's app in real time
- 60-second accept timer is enforced by the system's background scheduler
- When seller marks ready, system broadcasts the job to nearby online riders
- If no rider found within timeout, system may retry with wider search or cancel
- Seller's earnings are calculated at delivery and held until return window passes

---

## Important Rules

- **Accept within 60 seconds** — no exceptions, or order auto-cancels
- Seller must pack the correct items — wrong items lead to returns and complaints
- Seller cannot choose which rider delivers — system assigns automatically
- Seller must confirm pickup — this releases the rider to deliver
- Returns must be approved or rejected promptly

---

## What If Something Goes Wrong?

| Problem                           | What happens                                    |
| --------------------------------- | ----------------------------------------------- |
| Seller misses the accept timer    | Order auto-cancelled; customer refunded         |
| Item out of stock after accepting | Contact admin; may need to cancel partial order |
| No rider found                    | System retries or cancels; seller notified      |
| Rider does not arrive             | Seller can contact rider or admin               |
| Customer requests return          | Seller approves or rejects; see return flow     |

---

_Next → [Seller Earnings and Withdrawals](12-seller-earnings-and-withdrawals.md)_
