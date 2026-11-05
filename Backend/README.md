# Arise Commerce Backend

This directory is the production backend foundation for the customer, seller, and admin applications in this repository.

The target is a **modular monolith**: one codebase and one transactional data boundary, with independently scalable API, worker, outbox, and scheduler processes. It is intentionally not a set of premature microservices.

## Current status

The foundation is implemented: validated configuration, structured/redacted logging, HTTP security middleware, request correlation, normalized responses and errors, health probes, MongoDB transaction support, Redis/BullMQ connections, a transactional outbox dispatcher, worker/scheduler entry points, graceful shutdown, Docker development infrastructure, and a module-boundary check.

Business endpoints are not claimed as complete. They must be implemented contract-first in the sequence in [`docs/IMPLEMENTATION_ROADMAP.md`](docs/IMPLEMENTATION_ROADMAP.md). The existing customer OpenAPI file remains the source of truth for `/api/customer/v1`.

## Read first

- [`docs/CODEBASE_AND_PDF_ANALYSIS.md`](docs/CODEBASE_AND_PDF_ANALYSIS.md) - evidence from both frontends and the supplied PDF, including conflicts the backend must resolve.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - the tailored target architecture, boundaries, data model, reliability model, and scaling plan.
- [`docs/IMPLEMENTATION_ROADMAP.md`](docs/IMPLEMENTATION_ROADMAP.md) - vertical-slice delivery order and quality gates.

## Local start

```sh
cp .env.example .env
npm install
docker compose up -d mongo mongo-init redis
npm run dev
```

Run the non-HTTP processes in separate terminals:

```sh
npm run start:outbox
npm run start:worker
npm run start:scheduler
```

Verify the foundation:

```sh
npm run verify
```

Health endpoints:

- `GET /health/live` - process liveness; does not depend on infrastructure.
- `GET /health/ready` - MongoDB and Redis readiness.
- `GET /api/customer/v1/health` - customer contract health endpoint.

## Non-negotiable conventions

- Integer paise for money; ISO-8601 UTC on the wire; opaque string IDs.
- `{ "data": ... }` / `{ "data": [...], "meta": ... }` success envelopes and `{ "error": ... }` errors, matching existing clients.
- All seller-owned reads and writes include a server-derived `sellerId` scope. Never accept seller ownership from an untrusted request body.
- Checkout totals, inventory, eligibility, payment, order, refund, and shipment states are server-authoritative.
- A MongoDB replica set is required because checkout/order/inventory/outbox writes use transactions.
- Reliable domain events are inserted into `outboxEvents` in the same transaction as the aggregate change.
- Every external webhook, idempotent command, and event consumer has a durable deduplication record.

