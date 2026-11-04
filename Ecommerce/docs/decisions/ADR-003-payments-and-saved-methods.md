# ADR-003: Payments and saved methods

Status: Accepted  
Date: 2026-11-04

## Decision

Arise never receives or stores raw card PAN or CVV. Card and UPI collection is hosted by a
PCI-compliant payment provider or its native SDK. The app and Arise backend exchange only provider
tokens, opaque payment-method IDs, payment IDs, and provider actions.

### Flow

1. Backend revalidates the checkout session.
2. Customer selects a backend-allowed method.
3. Backend creates an idempotent payment intent.
4. The app performs the returned `REDIRECT`, `UPI_INTENT`, or `SDK` action.
5. Provider webhooks are authoritative. The app polls/refreshes payment status only for presentation.
6. Backend creates the order exactly once after successful capture or authorized COD selection.

Saved cards are provider tokens exposed only as brand, last four digits, expiry, and opaque ID.
Adding a card creates a provider-hosted setup session. Deleting a method invalidates the provider
token. CVV is never persisted and never sent to Arise.

Payment states are `CREATED`, `REQUIRES_ACTION`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, and
`UNKNOWN`. `UNKNOWN` requires reconciliation and must not create a second charge.

## Consequences

The app must handle provider return deep links, cancelled actions, pending status, retryable provider
errors, and webhook/app race conditions. Payment and order creation use independent idempotency keys.
