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
