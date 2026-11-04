# Customer Backend Handoff

The customer application is contract-first and ready for backend implementation. The canonical API specification is [`docs/api/customer-v1.openapi.yaml`](api/customer-v1.openapi.yaml). It is JSON-formatted YAML so both OpenAPI tooling and the repository's dependency-free contract test can parse it.

## Integration boundary

- Set `API_BASE_URL` to the versioned HTTPS API origin. Production startup rejects the example URL.
- Set `ENABLE_API_MOCKS=false` for integration, staging, and production builds.
- Implement response envelopes, error envelopes, cursor pagination, lifecycle enums, authentication, and idempotency exactly as specified.
- Treat cart totals, discounts, inventory, delivery estimates, payment state, order state, refunds, wallet balance, and eligibility as server-authoritative.
- Never send raw card PAN or CVV through the Arise API. The app creates a payment-method setup session and hands collection to the selected PCI-compliant provider.
- Preserve `Idempotency-Key` semantics for every command marked with the shared OpenAPI parameter.

## External deployment inputs

The following are intentionally not committed and must be supplied per environment:

- payment-provider publishable identifier and return/deep-link configuration;
- Firebase Android/iOS application files and push credentials;
- Android release keystore and signing properties;
- iOS bundle/team/provisioning configuration;
- App Store and Play Store production URLs;
- legal entity, privacy, grievance, and production support contact details;
- crash-reporting/analytics provider configuration if those transports are enabled.

Android signing reads `ARISE_UPLOAD_STORE_FILE`, `ARISE_UPLOAD_STORE_PASSWORD`, `ARISE_UPLOAD_KEY_ALIAS`, and `ARISE_UPLOAD_KEY_PASSWORD` from Gradle properties or the build environment. Without them, release artifacts remain unsigned; debug builds never reuse production keys.

## Verification gate

Before connecting a backend environment, run:

```sh
npm ci
npm run lint -- --quiet
npm run test:ci
npm run bundle:android
```

CI repeats those checks and compiles the Android debug application. The Maestro flow under `e2e/maestro` is the initial device smoke gate; stable accessibility/test identifiers should be expanded alongside the first backend environment.
