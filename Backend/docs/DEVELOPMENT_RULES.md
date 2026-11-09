# E-Commerce Backend — Mandatory Development Rules

Node.js + Express.js + JavaScript + MongoDB
Modular Monolith + Practical DDD + Event-Driven Architecture + Transactional Outbox

These rules are mandatory for every development task on this backend (and its customer/seller/admin clients). Before writing any code, the existing project architecture (`ARCHITECTURE.md`, `CODEBASE_AND_PDF_ANALYSIS.md`, `IMPLEMENTATION_ROADMAP.md`), codebase and business logic must be properly understood. Primary goal: clean, secure, optimized, reusable, scalable, maintainable and production-ready code.

This document is the project's own version of the generic architecture-PDF rulebook, rewritten against this repository's actual structure. Where the two disagree, this document and `ARCHITECTURE.md` win.

## 0. This project's actual structure (reference)

```text
backend/src/
  app/              app.js, server.js, routes.js
  config/           env.js, database.js, redis.js, logger.js
  modules/
    identity/  user/  seller/
    catalog/   category/  product/
    inventory/ cart/  wishlist/  address/
    order/     payment/  shipping/  coupon/
    review/    notification/  admin/
    search/    analytics/      system/
  shared/           errors/  http/  middleware/  utils/  constants/  validators/
  infrastructure/
    cache/  realtime/  storage/  queue/  events/
    external/  payment/  shipping/  notification/  maps/
  workers/
  bootstrap/
```

Each module in `modules/<name>/` follows the standard DDD layout:

```text
modules/<name>/
  domain/
    entities/  value-objects/  services/  events/  constants/
  application/
    use-cases/  dto/  ports/
  infrastructure/
    persistence/  events/
  presentation/
```

API surfaces are audience-namespaced, not a single generic tree:

- `/api/customer/v1/*`
- `/api/seller/v1/*`
- `/api/admin/v1/*`
- `/webhooks/v1/*`

Response envelope: success uses `{ data }` / `{ data, meta }`; errors use `{ error: { code, message, ... } }`. There is no `{ success, message }` wrapper in this project — do not add one.

Money is integer paise. IDs are opaque strings. Timestamps are ISO-8601 UTC. There is no `DELIVERY_PARTNER` role or delivery app — shipping/tracking comes from third-party logistics providers (e.g. Shiprocket) behind `infrastructure/external/shipping/`.

## 1. Follow the Existing Structure — No Exceptions

- Strictly follow the folder/file structure in Section 0 above and in `ARCHITECTURE.md` Section 3-4.
- Do not create, move or duplicate files randomly. Code for a module lives inside that module's own `domain/application/infrastructure/presentation` layers — never scattered across unrelated files or folders.
- Do not introduce a new architecture, pattern or folder convention without first understanding why the existing one was chosen.
- Reuse existing controllers, use-cases, services, repositories, routes, models, middleware, constants, config, validators and provider abstractions before adding new ones.
- If an existing file/module can absorb the required change, modify it. Do not create a second file for the same purpose.

**Rule:** First understand the existing architecture, then modify it. Do not create a new architecture unnecessarily.

## 2. No Unnecessary API Creation

- Before adding a new endpoint, check whether an existing route under `/api/customer/v1`, `/api/seller/v1` or `/api/admin/v1` already covers the need via query params, filters, pagination or optional fields.
- Do not create duplicate APIs for the same data. Only create a new endpoint for a genuinely different capability.
- Customer-facing contract changes must stay compatible with the canonical customer OpenAPI contract; additive fields only in v1.

**Rule:** Reuse existing APIs before creating new APIs.

## 3. Every New API Must Follow the Standard Design

Request lifecycle (matches `ARCHITECTURE.md` Section 5/`CODEBASE_AND_PDF_ANALYSIS.md`):

```text
Request → Security/Rate-limit → Authentication → Authorization → Validation
  → Controller (presentation) → Use Case (application) → Domain Rules
  → Repository/Provider Port → Infrastructure → Outbox (when required) → Response
```

- Clear endpoint naming, correct HTTP method, Zod validation, proper status codes, pagination/filtering where relevant, minimal request/response payload, the standard `{ data }` / `{ error }` envelope — never `{ success, message }`.
- Business logic belongs in the Application/Domain layers, not duplicated in controllers or routes.
- Every write returns the resulting resource or an accepted job ID, not a vague success string.
- Commands marked with `Idempotency-Key` must return the original outcome on a retry.

## 4. API Calls Must Be Optimized

- No duplicate, repeated or unlimited API/socket calls from clients.
- Avoid aggressive polling — prefer Socket.IO realtime events over polling where an event already exists; clients still refetch durable resources after reconnect (Socket.IO is never the source of truth).
- Reuse existing cached/Redis data instead of re-fetching.

**Rule:** Every API call must have a clear reason. No duplicate, unnecessary or unlimited API calls.

## 5. Centralized & Reusable Code

- Centralize repeated logic: API clients, constants, enums (order/payment/return status, roles), validation schemas, error classes, provider abstractions (`infrastructure/external/*`), formatting/helpers, permission/ownership checks.
- Do not write the same validation/business rule in multiple modules — put it in `shared/` or the relevant module's domain layer and reuse it.
- Do not over-abstract one-time, trivial logic.

**Rule:** Write once, reuse wherever logically applicable.

## 6. No Duplicate Implementation

Do not copy-paste the same logic across use-cases/controllers/modules. Extract a shared function/service instead.

## 7. No Unnecessary Dependencies

- Before installing any npm package, check whether it's already covered by an existing dependency (express, mongoose, ioredis, bullmq, socket.io, jsonwebtoken, bcrypt/argon2, zod, helmet, cors, compression, pino, pino-http, dotenv, uuid, http-status-codes, express-rate-limit, rate-limit-redis) or native Node/JS functionality.
- Avoid duplicate libraries solving the same problem.
- Do not remove an existing dependency without checking its usage across the whole project first.

## 8. No Dead Code / Dead Fields

No unused functions, components, hooks, variables, imports, routes, API methods, DB fields, request/response fields, commented-out code, debug code or stray `console.log`. Verify usage project-wide before deleting anything.

## 9. Minimal, Clean Payloads and Responses

Requests send only the fields the API actually needs. Responses return only required fields — no internal/sensitive fields, no unnecessary populated/nested data, no full documents when a projection would do.

## 10. Database Query Optimization

Fetch only required fields via projection; avoid unnecessary `.populate()`; avoid N+1 and duplicate queries; use pagination and indexes derived from real query/sort patterns (see `ARCHITECTURE.md` Section 7). Do not add new indexes blindly.

## 11. Backend Performance

Avoid repeated DB queries, duplicate business logic, unnecessary middleware, large responses, blocking/synchronous work on the request path. Prefer reusable services, efficient indexed queries, Redis caching where genuinely needed, and BullMQ workers for slow/background work. Never hold a MongoDB transaction open while calling a payment, shipping, notification, maps or storage provider.

## 12. Security & Environment Variables

- All secrets (DB credentials, JWT secret, payment/SMS/email/OAuth/webhook secrets, encryption keys, third-party API keys) must come from `process.env` via `config/env.js` — never hardcoded.
- Never expose secret/private keys to the client: not in API responses, request payloads, bundles, console logs, device storage, client-side state, or committed to git. Third-party calls needing a secret key go through `infrastructure/external/*` provider abstraction, never directly from the client.
- Card PAN/CVV never passes through this backend; a PCI provider owns collection and tokenization.
- `.env` stays gitignored; never commit passwords, tokens or production secrets. If a secret is accidentally committed, remove it from history and rotate/revoke the credential.
- Webhook signature verification is mandatory for payment and shipping providers; webhook processing must be idempotent (unique provider event ID receipt).

## 13. Business Logic Must Not Break

Before changing anything, trace the existing flow: API dependents → client dependents → DB dependents → auth/authorization → business rules (order/payment/fulfilment/return state machines) → events/outbox → workers/queues. Then implement the smallest safe change.

Keep the order decomposition intent: `Order` (commercial snapshot) is distinct from `OrderFulfilment` (seller/warehouse/courier execution) and `OrderItem` (item-level state). Do not collapse payment, fulfilment, shipment, return and refund into one mega status field. A central status-transition rule must reject invalid transitions, and seller actions must be authorized only for fulfilments belonging to that seller.

**Rule:** Optimize implementation, not the business requirement.

## 14. Scope Discipline — No Unrelated Changes

Change only what the task requires. No unnecessary refactors, renames, file moves, dependency swaps, API/DB/UI changes, or architecture changes outside the requested scope.

## 15. Code Quality

Clean, simple, readable, reusable, maintainable, efficient, secure, scalable, consistent, production-ready. Avoid over-engineering, over-abstraction, huge controllers/functions, magic values and hardcoded config — centralize in `shared/constants` instead.

## 16. Constants & Enums

Centralize repeated meaningful values (order/payment/return/fulfilment status, roles, pagination defaults, feature flags) as constants/enums instead of hardcoded strings scattered across modules. Do not over-constant-ize one-off literals.

## 17. Consistent Error Handling & Logging

Use the `AppError`-style centralized error classes (`shared/errors/`); never leak stack traces or secrets in production responses. Use Pino for logging with `requestId` attached; never log passwords, tokens, API keys, OTPs or other sensitive data.

## 18. Idempotency & Reliability

- Assume jobs, webhooks and events can be retried. A consumer must safely ignore or handle duplicates.
- Use event IDs, idempotency keys and unique constraints for sensitive flows: payments, refunds, inventory reservation, shipment creation.
- Transactional outbox: durable state change and its outbox event are written in the same MongoDB transaction; the outbox worker dispatches and marks processed. Do not rely on an in-memory emitter after commit.
- Do not rely on exactly-once event delivery — delivery is at-least-once; handlers must be idempotent.
- Do not use database transactions for every CRUD operation; use them where atomicity is actually required (checkout, order+inventory+outbox, payment/refund).

## 19. Search Before Adding Anything

Before adding new code, a package, an API, a field or a file, check: does an existing implementation/API/component/utility/dependency/model field/constant/business flow already cover this? Only add new code once reuse is confirmed not possible.

## 20. Do Not Assume — Verify Against the Codebase

Never assume an API, utility, package, field or component is unavailable, or that a new file/architecture is required — inspect the actual codebase first.

## 21. Minimal Change Principle

Prefer the smallest change that satisfies the requirement over rewriting a module, creating new APIs or installing multiple packages for a small ask.

## 22. Production-Level Thinking

Every change must consider: performance, security, scalability, API/network payload size, DB performance, memory usage, error handling, maintainability, concurrent users (seller isolation under multi-tenant load), failure cases and production deployment — not just "it works locally."

## 23. Final Self-Review Checklist (run before considering any task done)

- **STRUCTURE:** existing structure followed? correct module/layer used per Section 0?
- **API:** existing API reused where possible? no duplicate API? validation present? `{ data }` / `{ error }` envelope used, not `{ success, message }`?
- **API CALLS:** no duplicate/unlimited calls? no unnecessary polling? listeners cleaned up?
- **CODE:** no dead code, duplicate logic, unused imports/fields?
- **DEPENDENCIES:** new package genuinely required and justified? nothing unused left behind?
- **CENTRALIZATION:** common logic centralized, not duplicated across modules?
- **PAYLOAD/RESPONSE:** only required fields sent/returned? no sensitive data leaked?
- **DATABASE:** queries optimized, projected, paginated, properly indexed?
- **SECURITY:** no hardcoded secrets? `.env` used? no keys exposed client-side, in logs, or in git? webhook signatures verified?
- **PERFORMANCE:** no unnecessary processing, DB calls or re-renders?
- **BUSINESS LOGIC:** existing order/payment/fulfilment/return state machines safe? seller isolation intact?
- **SCOPE:** only the requested change made? no unrelated files touched?

## 24. Golden Rules Summary

1. Always follow the existing structure defined in Section 0 and `ARCHITECTURE.md`.
2. Understand code before changing it.
3. Reuse existing APIs; avoid duplicate/unnecessary ones.
4. Design every new API to production standard (Section 3).
5. Prevent duplicate/unlimited API and socket calls.
6. Keep payloads and responses clean and minimal.
7. Optimize every database query; fetch only what's required.
8. Never leave dead code, dead fields or unused dependencies.
9. Centralize and reuse logic instead of duplicating it.
10. Install a new package only when existing code genuinely cannot solve it.
11. Use environment variables for every secret; never hardcode or leak them.
12. Never break existing business logic, order state transitions or payment flows.
13. Change only what the task requires — no unrelated changes.
14. Avoid over-engineering; prefer simple, clean, optimized solutions.
15. Treat performance, security and scalability as first-class requirements on every change.
16. Every file, API, function, field, dependency and variable must have a clear, justified purpose.
17. Never collapse order/payment/fulfilment/shipment/return into one status field. Never add a `DELIVERY_PARTNER` role — shipping is third-party-provider-driven.

**Core Development Philosophy:** Understand the existing code first, then reuse it, then optimize it, and only add new code when it is genuinely required. Working code is not enough — it must also be clean, optimized, secure, reusable, scalable and maintainable. One functionality → one proper reusable implementation, built inside the correct module and layer as defined in this document.
