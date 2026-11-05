# Codebase and PDF analysis

## Executive finding

The PDF chooses the correct macro-architecture for this repository: a Node.js/Express modular monolith with MongoDB, Redis, BullMQ, Socket.IO, practical DDD, provider ports, and a transactional outbox. That choice should be retained.

It is a blueprint, not a build-ready specification for this codebase. The existing clients are substantially broader and more precise than the PDF: the customer app already has a canonical 105-operation OpenAPI contract, and the combined admin/seller UI exposes hundreds of additional request shapes. The backend therefore needs bounded contexts and API adapters that the generic PDF does not name.

## Repository evidence

| Area | What exists | Backend implication |
|---|---|---|
| `Backend/` | Was empty before this foundation | No legacy server behavior needs preservation |
| Customer app | React Native 0.76, RTK Query, Axios, Zod, secure refresh-token persistence, fixture adapters | Implement the existing contract; do not invent a second customer API |
| Customer contract | OpenAPI 3.1, 92 paths and 105 operations | Treat as the canonical customer acceptance contract |
| Admin UI | React/Vite with broad mock engines and about 367 unique statically detectable request shapes | Deliver by bounded context and replace mocks incrementally |
| Seller UI | Shares the admin codebase but switches to `/api/seller/v1`; about 90 unique statically detectable request shapes | Same domain use-cases, separate audience adapter and authorization policy |
| Architecture PDF | 14 pages; modular monolith, DDD, outbox, workers, shipping provider abstraction | Sound baseline, but must be reconciled with client contracts |

Counts are a static inventory, not a promise that every mock path is a production requirement. Dynamic routes and calls hidden behind generic helpers can make the true count slightly higher. Product ownership must classify admin/seller mock endpoints as required, deferred, or mock-only before implementation.

## Existing contract decisions that must survive

The customer app and its ADRs already establish these rules:

- API base: `/api/customer/v1`, not the PDF's generic `/api/v1`.
- Admin base: `/api/admin/v1`; seller base: `/api/seller/v1`.
- Successful resources use `{ data }`; lists use `{ data, meta }`; errors use `{ error: { code, message, ... } }`.
- Money is integer paise. IDs are opaque strings. Timestamps are ISO-8601 UTC.
- Commands marked with `Idempotency-Key` must return the original outcome on a retry.
- The server owns price, discount, tax, shipping charge, inventory, payment state, order state, refund state, and eligibility.
- Card PAN/CVV never passes through this backend; a PCI provider owns collection and tokenization.
- Refresh is designed for rotation and single-flight retry in both client families.
- Customer public enums currently include:
  - Order: `PENDING_PAYMENT`, `CONFIRMED`, `PROCESSING`, `PACKED`, `READY_TO_SHIP`, `SHIPPED`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `PAYMENT_FAILED`, `DELIVERY_FAILED`, `CANCELLED`.
  - Return: `REQUESTED`, `APPROVED`, `PICKUP_SCHEDULED`, `PICKED_UP`, `RECEIVED`, `QC_PASSED`, `QC_FAILED`, `REJECTED`, `REFUND_INITIATED`, `REFUND_COMPLETED`, `REPLACEMENT_SHIPPED`, `CANCELLED`.
  - Payment: `CREATED`, `REQUIRES_ACTION`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `UNKNOWN`.
  - Refund: `NOT_REQUIRED`, `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`.

## Where the PDF is right

1. **Modular monolith before microservices.** The business has many workflows but no evidence yet of the traffic, team topology, or independent deployment needs that justify distributed transactions and operational fragmentation.
2. **Practical DDD.** Order, pricing, inventory, payment, return/refund, shipping, wallet/ledger, settlement, and approval workflows warrant explicit state machines and invariants. Categories and static lookups do not need ceremonial aggregates.
3. **Transactional outbox.** Order/inventory/payment transitions cannot rely on an in-memory emitter after commit.
4. **Provider abstraction.** Payments, courier/logistics, notifications, media storage, maps/pincode, and KYC must sit behind ports.
5. **Independent worker scaling.** Long and retryable work should run outside request processes while remaining in the same repository.
6. **No delivery-partner application.** Courier state comes from third-party providers and webhooks.

## Required corrections and extensions

### 1. Use audience namespaces, not one generic route tree

The PDF's `/api/v1/*` layout conflicts with all clients. Keep three presentation surfaces:

- `/api/customer/v1`
- `/api/seller/v1`
- `/api/admin/v1`

They call shared application use-cases. They are not three services and must not fork business logic.

### 2. The response envelope in the PDF is incompatible

The PDF proposes `{ success: true, message, data, meta }`. Existing clients and OpenAPI use `{ data, meta }` and `{ error }`. Adding a mandatory `success` flag creates churn without value. The backend follows the existing contract.

### 3. Domain coverage is incomplete

The PDF omits or under-specifies domains already present in the clients: returns/replacements, wallet and gift cards, seller settlement/payout/tax, warehouse and inbound/removal, support tickets/chat/SLA, product Q&A, privacy requests, CMS/help/app config, promotions/flash sales/referrals/ads, admin RBAC, maker-checker approvals, audit, imports/exports, and background jobs.

These are grouped into cohesive bounded contexts in the target architecture instead of creating one module per screen.

### 4. One order status is not enough internally

The customer sees a stable summarized status. Seller and admin workflows operate at seller-fulfilment and item level. A multi-seller cart can produce fulfilments moving at different speeds.

Use:

- `Order` - customer purchase and immutable commercial snapshot.
- `OrderFulfilment` - seller/warehouse/courier execution unit.
- `OrderItem` - item-level cancellation, return, tax, and status facts.
- A projection policy maps internal states to the customer `OrderStatus` enum.

Do not force payment, fulfilment, shipment, return, and refund into one mega-state machine.

### 5. Outbox publication is not the same as idempotent consumption

The PDF mentions idempotency but does not fully specify the consumer side. Every handler that causes a durable effect needs a unique `(eventId, handlerName)` processed-event/inbox record in the same transaction as its effect. Payment and shipping webhooks need a separate durable webhook receipt keyed by provider and provider event ID.

### 6. MongoDB transactions require deployment support

Transactions do not work against a standalone MongoDB process. Development, CI, staging, and production must run a replica set (or sharded cluster). The included Docker setup initializes a single-node replica set for local work.

### 7. Old delivery-partner documents are stale

The customer documentation tree still contains legacy delivery-partner/rider flow documents, while the final PDF explicitly removes that role and the current product uses third-party logistics. Those files are historical references, not backend scope. Courier pickup/tracking/reconciliation belongs to the shipping context; there is no `DELIVERY_PARTNER` identity or panel.

### 8. Socket.IO must remain an optimization

Realtime events improve UX but cannot be the source of truth. Clients refetch durable resources after reconnect. Multi-instance Socket.IO requires the Redis adapter and authenticated rooms such as `user:{id}`, `seller:{id}`, and privileged admin scopes.

## Main delivery risk

The largest risk is breadth, not the framework. Implementing hundreds of mock endpoints horizontally would create a large, shallow CRUD server with inconsistent invariants. Delivery must be vertical: one business journey at a time, with contract tests, persistence, authorization, outbox events, audit, and observability completed together.

