# API Reference

Running log of every API this backend implements. Updated every time a new endpoint is added — no endpoint goes live without an entry here.

Rules for this file (see `DEVELOPMENT_RULES.md`):
- One row per endpoint, added the same time the endpoint is implemented, not after.
- "Purpose" states *why* the API exists in plain words — what it is used for, not just what it technically does.
- Response envelope is always `{ data }` / `{ data, meta }` on success and `{ error: { code, message, ... } }` on failure — never documented otherwise here.
- Group endpoints by module, in the order they are implemented (matches `IMPLEMENTATION_ROADMAP.md` phases).

Base paths: `/api/customer/v1`, `/api/seller/v1`, `/api/admin/v1`, `/webhooks/v1`.

---

## Format

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/customer/v1/health` | none | Liveness/readiness check for the customer API surface. |
| `GET` | `/metrics` | Bearer `METRICS_TOKEN` (404 if unset) | Prometheus scrape: HTTP latency by route, queue depth/failures, outbox lag, webhook backlog, socket count. Used for SLO dashboards and alerts. |
| `POST` | `/api/{customer|seller|admin}/v1/uploads` | Bearer JWT (role per `purpose`) | Multipart (`purpose` + `file`) upload of images/videos/PDFs to local disk. Type is sniffed from file bytes, size-limited, saved under the owner id from the token; returns `{ key, mime, sizeBytes, url? }` (`url` only for public files). |
| `GET` | `/api/{customer|seller|admin}/v1/uploads/private/:folder/:ownerId/:file` | Bearer JWT (owner or admin) | Download a private file (KYC docs, return proofs). Others get 404; private files are never served statically. |
| `GET` | `/uploads/*` | none | Public media (product/review/CMS images & videos), long-cached. In production nginx serves the same folder directly. |

---

## identity

| Method | Path | Auth | Purpose |
|---|---|---|---|

## user

| Method | Path | Auth | Purpose |
|---|---|---|---|

## seller

| Method | Path | Auth | Purpose |
|---|---|---|---|

## catalog / category / product

| Method | Path | Auth | Purpose |
|---|---|---|---|

## inventory

| Method | Path | Auth | Purpose |
|---|---|---|---|

## cart / wishlist / address

| Method | Path | Auth | Purpose |
|---|---|---|---|

## order

| Method | Path | Auth | Purpose |
|---|---|---|---|

## payment

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/webhooks/v1/payments/razorpay` | Razorpay HMAC signature (`x-razorpay-signature`) | Receives Razorpay payment/refund events; verifies the signature on the raw body, stores a deduplicated receipt (unique `x-razorpay-event-id`), enqueues it to the `webhooks` queue for idempotent processing, and acknowledges fast so Razorpay retries stay harmless. Not rate-limited by IP (signature-gated). |

## shipping

| Method | Path | Auth | Purpose |
|---|---|---|---|

## coupon

| Method | Path | Auth | Purpose |
|---|---|---|---|

## review

| Method | Path | Auth | Purpose |
|---|---|---|---|

## notification

| Method | Path | Auth | Purpose |
|---|---|---|---|

## admin

| Method | Path | Auth | Purpose |
|---|---|---|---|

## search

| Method | Path | Auth | Purpose |
|---|---|---|---|

## analytics

| Method | Path | Auth | Purpose |
|---|---|---|---|

## system

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | none | Internal health probe used by the load balancer/orchestrator. |
| `GET` | `/api/customer/v1/health` | none | Customer-contract health check (aliases the internal `/health` probe). |

## webhooks

| Method | Path | Auth | Purpose |
|---|---|---|---|
