# Implementation roadmap

## Delivery method

Build vertical journeys, not layers across the entire platform. A slice is complete only when it includes contract, validation, authorization, domain rule, persistence/indexes, idempotency where required, outbox/audit behavior, tests, metrics/logs, and operational notes.

## Phase 0 - foundation (implemented here)

- Validated environment and redacted structured logging.
- Express security, request IDs/context, response/error helpers, health probes.
- Mongo/Redis lifecycle and Mongo transaction helper.
- BullMQ domain-event queue and independently runnable worker.
- Transactional outbox schema and leased dispatcher.
- Scheduler process role, graceful shutdown, Docker development stack.
- Module-boundary check and architecture documents.

Exit gate: install succeeds, `npm run verify` passes, containers start, liveness/readiness are observable.

## Phase 1 - identity and contract harness

- Copy/reference the customer OpenAPI in backend tests and add request/response schema validation in CI.
- Customer OTP/password flows, access tokens, rotating refresh sessions, device logout/all-devices logout.
- Admin/seller browser authentication, MFA-ready session model, RBAC and seller-scoped principals.
- Durable idempotency middleware and request hash rules.
- Audit foundation.

Exit gate: the mobile authentication fixture can be disabled and its auth/session tests run against this backend.

## Phase 2 - seller, catalog, and discovery reads

- Seller onboarding/KYC/status and admin approval.
- Category, brand, product, variant, seller listing/offer, media metadata.
- Published home/app config/help and search abstraction.
- Cache-aside plus event-driven invalidation.

Exit gate: customer home/category/search/product paths and the first seller/admin catalog journeys use live data.

## Phase 3 - inventory, warehouse, cart, pricing

- Inventory balance/movement/reservation invariants and seller isolation.
- Warehouses, inbound/removal basics needed by fulfilment.
- Cart/wishlist/address/serviceability.
- Versioned pricing/fee/tax/shipping quote engine; coupons and usage constraints.

Exit gate: concurrent stock tests prove no oversell; cart totals are fully server-authoritative.

## Phase 4 - checkout, order, and outbox-critical path

- Expiring checkout session and quote snapshot.
- Customer order, items, seller fulfilments, state machines and customer status projection.
- Atomic order + reservation + coupon + outbox transaction.
- Seller/admin order reads and actions with audit.

Exit gate: repeated idempotency keys return one order; injected crashes do not lose committed events; multi-seller tests pass.

## Phase 5 - payment, wallet, finance

- Provider port and sandbox adapter, payment attempts, raw signed webhooks, receipt deduplication.
- Reconciliation and refund orchestration.
- Immutable wallet/store-credit and finance ledgers.
- Seller settlement, commission, payout, invoice/tax projections required by the panels.

Exit gate: webhook replay/out-of-order tests, amount reconciliation, refund caps, balanced ledger tests, and provider outage drills pass.

## Phase 6 - shipping, returns, notifications, realtime

- Shipping provider port, shipment/label/pickup/tracking/NDR/RTO and webhook reconciliation.
- Return eligibility, pickup, QC, replacement, refund workflow.
- Notification inbox/preferences/templates/delivery attempts.
- Authenticated Socket.IO rooms and Redis adapter; refetch-after-reconnect behavior.

Exit gate: courier webhook replay cannot regress status; return/refund journeys reconcile to payments and wallet; no delivery-partner role exists.

## Phase 7 - operations and growth

- Support tickets/chat/SLA, reviews/Q&A/moderation.
- CMS, promotions, flash sales, referrals, ads.
- Maker-checker approvals, integrations, privacy jobs.
- Analytics projections, exports, scheduled reports.

Exit gate: each migrated admin/seller mock group has an OpenAPI contract and its mock can be disabled independently.

## Phase 8 - production hardening

- OpenTelemetry traces, metrics dashboards, SLOs and alerts.
- Load tests for auth bursts, catalog reads, cart, checkout, inventory contention, webhooks, exports, and sockets.
- Dependency/container scanning, secret manager, WAF/rate policies, backup/restore and disaster-recovery exercises.
- Zero-downtime index/migration playbook, feature flags, canary rollout and rollback drills.

## Test pyramid and gates

- Domain unit tests: state transitions, money, pricing, inventory, policy rules.
- Repository integration tests: real replica-set MongoDB and Redis; indexes and transactions.
- Contract tests: all OpenAPI operations and envelopes.
- Journey tests: client-facing flows across modules/providers with sandbox adapters.
- Concurrency tests: oversell, duplicate payment/refund/shipment, approval races.
- Failure tests: process crash after commit, Redis outage, provider timeout, duplicate/out-of-order webhook.
- Load tests: measured SLOs and capacity thresholds before launch.

No phase is complete with mocked persistence on the server or controller-only tests.

