# ADR-004: API contracts, versioning, and cross-panel consistency

Status: Accepted  
Date: 2026-11-04

## Decision

Customer HTTP APIs are rooted at `/api/customer/v1`. The OpenAPI document in
`docs/api/customer-v1.openapi.yaml` is the canonical interface. Zod schemas and fixtures are consumer
implementations of that contract and must be tested against it.

Success responses use `{ data, meta? }`. Errors use
`{ error: { code, message, fieldErrors?, details?, requestId, retryable? } }`. Dates are UTC ISO-8601,
money is integer paise, IDs are opaque strings, and cursor pagination uses `nextCursor`.

Commands that create money movement, orders, returns, tickets, media, redemptions, or other duplicate-
sensitive resources require `Idempotency-Key`. The backend retains command results long enough for
safe mobile retry.

Shared enums are generated from one platform contract package for customer, seller, admin, workers,
and fixtures. Cross-panel contract tests prove that customer-created orders, returns, tickets, and
reviews are readable in their corresponding operational panels.

Breaking field or semantic changes require a new API version. New optional fields and enum values
require forward-compatible client handling and a documented rollout plan.
