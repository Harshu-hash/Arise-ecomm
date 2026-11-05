# Seller panel backend-readiness audit

**Audit date:** 2026-11-05  
**Scope:** seller SPA, shared admin/customer mock domain, machine-readable seller
contract, production client behavior, and backend foundation.

## Decision

The seller panel is **backend-handoff-ready**. Backend business implementation
can proceed without adding more seller screens or inventing a second API surface.

This does not mean the marketplace backend is implemented or production-ready.
The browser mock remains the executable acceptance specification; production
persistence, authorization, provider integrations, jobs and observability belong
to backend delivery.

## Evidence

| Surface | Current evidence | Finding |
| --- | --- | --- |
| Seller UI | 66 page modules, concrete navigation, 18 feature API modules | No placeholder business route remains. |
| Seller contract | OpenAPI 3.1, 199 paths, 225 operations | Every statically detected production client method/path is represented. |
| Contract drift gate | Source-to-OpenAPI Vitest checks | CI rejects missing operations, duplicate operation IDs, missing policy metadata and non-idempotent authenticated mutations. |
| Domain behavior | Shared seller/admin/customer mock engines and integration journeys | State transitions, ownership, money and cross-panel projections are executable acceptance behavior. |
| Backend | Express modular-monolith foundation | Infrastructure is ready; `/api/seller/v1` business routers remain to be implemented. |

## Completed handoff controls

- Seller OpenAPI uses `/api/seller/v1`, opaque IDs, integer paise, UTC timestamps,
  `{ data, meta }` success envelopes and `{ error }` failures.
- Every authenticated operation declares a permission policy. Production handlers
  must additionally derive `sellerId` from the authenticated principal.
- Every authenticated mutation declares idempotency. The client automatically
  supplies a command key and preserves explicit workflow keys.
- Live authentication uses short-lived bearer access plus a rotated Secure,
  HttpOnly refresh cookie. Bootstrap and single-flight 401 recovery do not require
  a JavaScript-visible refresh token.
- Switching to the seller audience preserves the configured API origin, supporting
  both a same-origin reverse proxy and a dedicated API host.
- Query parameters are serialized once; the finance-document and help-search
  adapters no longer wrap `params` twice.
- Production source maps are disabled unless explicitly enabled.
- The contract inventory records shared application ownership, errors, evidence,
  artifact, bulk-job and state-machine semantics for S9 through S18.

## Verification snapshot

- `npm run verify:seller`: passed.
- ESLint: passed with zero warnings.
- Contract/client gate: 4 files, 8 tests passed.
- Bounded seller suite: 23 files, 159 tests passed.
- Seller route assertions: 56 passed.
- Vite live-mode build: passed for admin and seller entries.
- OpenAPI YAML parse: 199 paths / 225 operations.
- Backend `npm run verify`: boundary check and 2/2 foundation tests passed.

The bounded worker configuration is intentional: the combined UI suite is CPU
heavy and previously produced timeout-only failures under unconstrained parallel
execution.

## Backend implementation order

1. Identity, MFA, rotating refresh sessions, audit and server-side RBAC.
2. Seller onboarding and the listing-to-admin-QC golden loop.
3. Inventory reservation, seller fulfilment, courier webhooks and documents.
4. Returns, QC and refund orchestration.
5. Immutable settlement/finance ledgers, payout and tax artifacts.
6. Media processing, imports/exports, reports, notifications, analytics and growth.

Each slice must include validation, seller isolation, persistence/indexes,
idempotency records, audit/outbox behavior, contract tests and operational
telemetry before its mock handler is disabled.

## Remaining non-blocking UI debt

- The live build still reports a large shared `global` chunk and heavyweight chart
  and spreadsheet chunks. Address this before performance/load certification.
- Add deployed-backend browser smoke journeys for login/MFA, listing QC,
  fulfilment, refund, payout and scheduled-report delivery as each backend slice
  becomes available.

## Source-of-truth rule

Use the seller OpenAPI for transport, the API inventory for ownership and policy,
the mock engines/tests for acceptance behavior, and the architecture documents for
system shape. Customer, seller and admin adapters must call shared application
use-cases rather than fork business rules by audience.
