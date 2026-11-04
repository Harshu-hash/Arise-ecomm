# ADR-001: Commerce, fulfilment, and order lifecycle

Status: Accepted  
Date: 2026-11-04  
Scope: Customer, seller, admin, warehouse, and courier integrations

## Decision

Arise is a multi-vendor marketplace. A customer owns one active cart that may contain offers from
multiple sellers. Checkout creates one customer order and one or more seller groups. Each seller
group can produce one or more shipments.

The backend owns all commercial and fulfilment decisions. The customer app never selects a seller,
calculates an authoritative total, decrements stock, or advances a lifecycle state.

### Core ownership

- `Product` is shared catalog content.
- `Offer` is the sellable seller/SKU combination and owns price, tax code, fulfilment promise,
  return policy, quantity limits, and eligibility.
- `InventoryPosition` owns available-to-promise stock for an offer at a seller or platform node.
- `CartItem` references an offer and variant, not only a product.
- `CheckoutSession` is an expiring immutable commercial quote. A revalidation produces a new
  version when stock, price, fees, serviceability, or promise changes.
- `Order` is the customer-visible parent. `SellerOrder` owns seller processing. `Shipment` owns the
  courier lifecycle. `ReturnRequest` and `Refund` have independent lifecycles.

### Fulfilment

Both seller-fulfilled and platform-fulfilled offers are supported. The offer declares the model and
fulfilment node. Last-mile delivery is performed through third-party courier adapters; there is no
first-party rider domain in v1.

The buy box is selected server-side from serviceability, stock, landed price, seller eligibility,
promise, and policy. The selected offer is locked in the checkout session and revalidated before a
payment intent is created.

### Canonical order state machine

`PENDING_PAYMENT -> CONFIRMED -> PROCESSING -> PACKED -> READY_TO_SHIP -> SHIPPED -> IN_TRANSIT ->
OUT_FOR_DELIVERY -> DELIVERED`

Terminal/exception states are `PAYMENT_FAILED`, `CANCELLED`, and `DELIVERY_FAILED`. Returns do not
replace the order state. Customer presentation derives a label from order, shipment, return, and
refund state.

Only the backend may transition states. Every transition records actor, reason code, timestamp,
source, request ID, and previous/new state. Duplicate commands are idempotent.

### Cancellation, return, and refund

- Cancellation eligibility is returned by the backend per order item and seller group.
- A cancellation can be partial. Refund creation is asynchronous when money was captured.
- A delivered order remains `DELIVERED`; a linked return moves independently through `REQUESTED`,
  `APPROVED`, `PICKUP_SCHEDULED`, `PICKED_UP`, `RECEIVED`, `QC_PASSED`/`QC_FAILED`, and resolution.
- Refund states are `NOT_REQUIRED`, `PENDING`, `PROCESSING`, `SUCCEEDED`, and `FAILED`.

### Money and time

All wire amounts are integer paise with `currency: INR`. All persisted timestamps and API timestamps
are ISO-8601 UTC. IDs are opaque strings. Display formatting and timezone conversion are client
concerns.

## Consequences

Customer, seller, and admin APIs must use the same canonical enums. Seller/admin may expose more
operational detail, but may not redefine a shared state. Customer responses include allowed actions
so the app never recreates policy rules.
