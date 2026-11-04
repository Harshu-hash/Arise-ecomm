# Customer App Backend-Readiness Plan

Status: backend implementation ready (completed 2026-11-04)  
Scope: `Ecommerce/` React Native customer application  
Primary outcome: make every customer-facing flow UI-complete, contract-defined, testable, and ready to replace mocks with a real backend without redesigning screens or inventing payloads during backend development.

## Completion gate

The customer app now has a canonical OpenAPI 3.1 contract with 92 paths and 105 operations, accepted commerce/payment/versioning ADRs, validated DTO boundaries, stateful contract fixtures, secure hosted payment-method setup, server-authoritative lifecycle states, runtime environment validation, offline mutation protection, app maintenance/version gates, native deep links, CI, and an initial Maestro smoke flow. Unsupported Play navigation has been removed until it has a product contract.

Final verification: 51 suites / 157 tests pass, ESLint passes with zero errors under `--quiet`, the Android production Metro bundle succeeds, and the complete Android debug build succeeds. Backend teams can begin implementation against `docs/api/customer-v1.openapi.yaml`; deployment-only credentials and legal/store values remain intentionally external and are listed in `docs/BACKEND_HANDOFF.md`.

## Implementation progress

Started: 2026-11-02

- [x] Pin a React Native 0.76-compatible TypeScript toolchain for ESLint.
- [x] Install and configure the Babel module import resolver.
- [x] Make the lint command execute successfully; legacy size/import warnings remain tracked for feature migrations.
- [x] Add Jest configuration and the first customer-app tests.
- [x] Implement validated environment and customer API configuration.
- [x] Implement Axios clients, normalized errors, request IDs, idempotency headers and single-flight token refresh.
- [x] Implement the RTK Query base API and tag catalog.
- [x] Implement and mount the Redux store.
- [x] Implement the in-memory authentication/session slice and selectors.
- [x] Define the first real customer contract: auth endpoint paths, Zod schemas, DTO mappers and RTK Query endpoints.
- [x] Fix the undefined `haptics` checkout runtime error.
- [x] Add Keychain/Keystore-backed refresh-token persistence and cold-start session restoration.
- [x] Add a contract-matching authentication fixture transport with login, signup, refresh, resend and password-reset flows.
- [x] Replace timer-simulated Login, Signup, OTP, Forgot Password and Reset Password actions with RTK Query mutations.
- [x] Add OTP autofill/paste handling, server-driven resend timing, normalized errors and secure logout cleanup.
- [x] Validate the authentication milestone with 15 unit/contract tests, quiet lint, an Android production Metro bundle and a native Android debug build.
- [x] Persist onboarding completion in MMKV and restore it during application bootstrap.
- [x] Remove the duplicate authentication/onboarding boot context in favor of Redux selectors.
- [x] Split the monolithic root stack into root, auth and customer navigators.
- [x] Guard account-sensitive customer routes and restore the intended destination after authentication.
- [x] Add navigation-container refs, centralized core route names and the first `arise://` deep-link map.
- [x] Wire profile logout and logout-all-devices to the real auth mutations and cache cleanup.
- [x] Validate the navigation/boot milestone with 22 tests, quiet lint and an Android production Metro bundle.
- [x] Add backend entity loaders and recoverable not-found states for category and product ID-based deep links.
- [x] Define validated `/home` and `/app-config` customer contracts with forward-compatible CMS sections.
- [x] Add contract-matching Home and app-config fixture transport alongside authentication fixtures.
- [x] Migrate Home from direct mock imports to RTK Query with paise-to-display DTO mapping.
- [x] Add Home skeleton, full-page error/retry, empty state, pull-to-refresh and partial-section failure handling.
- [x] Validate the first catalog milestone with 28 tests, quiet lint and an Android production Metro bundle.
- [x] Define validated category-tree, category-detail and paginated brand-list contracts.
- [x] Add matching category/brand fixtures, including filter behavior and recoverable category 404 responses.
- [x] Migrate Categories and Brands from direct mock ownership to RTK Query with refresh, loading, empty and error states.
- [x] Resolve category deep links by opaque category ID instead of display-name matching.
- [x] Validate the category/brand milestone with 35 tests, quiet lint and an Android production Metro bundle.
- [x] Define validated suggestions, paginated search-results and product-detail contracts with paise-to-display mapping.
- [x] Add contract-matching search/product fixtures with filtering, sorting, cursor pagination and recoverable product 404 responses.
- [x] Migrate Search, Search Results and Product Detail to RTK Query with debounce, persisted history, loading, retry, empty, refresh and pagination states.
- [x] Validate the search/product milestone with 45 tests, quiet lint and an Android production Metro bundle.
- [x] Define validated wishlist list/add/remove/move-to-cart contracts and matching stateful fixtures.
- [x] Replace seeded Wishlist state and disconnected product/search heart state with one RTK Query cache.
- [x] Add optimistic wishlist removal and move-to-cart updates with rollback and unavailable-product conflict handling.
- [x] Validate the wishlist milestone with 50 tests, quiet lint and an Android production Metro bundle.
- [x] Define validated cart, saved-for-later, quantity and coupon contracts with server-owned paise totals and checkout eligibility.
- [x] Add stateful cart/coupon fixtures covering repricing, quantity conflicts, coupon minimums and wishlist-to-cart transfer.
- [x] Replace `CartContext` across Cart, Checkout, CouponSection and the app root with one RTK Query cart cache.
- [x] Wire Product Detail Add to Bag and wishlist Move to Cart into the shared cart contract.
- [x] Validate the cart milestone with 56 tests, quiet lint and an Android production Metro bundle.
- [x] Define validated address CRUD, atomic-default, validation and pincode-serviceability contracts.
- [x] Add stateful address fixtures with field errors, unsupported-area conflicts and structured address data.
- [x] Replace seeded address ownership across Saved Addresses, Home, Cart and Checkout with the shared address cache.
- [x] Add address loading, empty, retry, refresh, form-validation and serviceability states.
- [x] Validate the address/serviceability milestone with 63 tests, quiet lint and an Android production Metro bundle.
- [x] Define validated checkout-session, payment-intent, payment-confirmation and placed-order contracts.
- [x] Add stateful checkout/payment fixtures with immutable quotes, payment-before-order enforcement and idempotent retry behavior.
- [x] Replace random local order IDs and timer-simulated purchase completion with backend-created payment and order entities.
- [x] Pass only the checkout session ID into Payment; load authoritative totals, items, address and allowed methods from the session.
- [x] Clear and invalidate the cart only after successful server order creation.
- [x] Validate the checkout/payment/order-creation milestone with 70 tests, quiet lint and an Android production Metro bundle.
- [x] Define validated paginated order-history, order-detail, timeline and cancellation contracts.
- [x] Add order fixtures with lifecycle filtering, cursor pagination, stable deep links and cancellation conflicts.
- [x] Replace seeded My Orders and Order Detail data with shared RTK Query order entities and backend timelines.
- [x] Replace locally simulated cancellation with a server mutation and lifecycle-based eligibility.
- [x] Resolve newly placed and historical orders through the same backend order-ID path.
- [x] Validate the order-history/detail/cancellation milestone with 76 tests, quiet lint and an Android production Metro bundle.
- [x] Define validated return-eligibility, return-request, return-detail, cancellation and refund-status contracts.
- [x] Add return fixtures with server-managed reasons, resolution rules, pickup addresses, duplicate prevention and evidence-required failures.
- [x] Replace support's duplicated mock order picker with the shared order API and stable order IDs.
- [x] Replace locally simulated return/replacement completion with persisted backend return entities.
- [x] Disable evidence-required submissions until the media-upload workflow supplies valid media IDs.
- [x] Validate the return/refund foundation with 82 tests, quiet lint and an Android production Metro bundle.
- [x] Define validated shipment-tracking contracts for courier events, ETA, attempts, delivery agents, coordinates and delivery-code visibility.
- [x] Replace fabricated rider/map/status simulation with courier-supplied tracking data and recoverable tracking deep links.
- [x] Add foreground polling, pull-to-refresh, timestamp presentation and explicit no-location states.
- [x] Enforce coordinate validation and delivery-code redaction outside the permitted shipment stage.
- [x] Validate the shipment-tracking milestone with 88 tests, quiet lint and an Android production Metro bundle.
- [x] Define a validated return-evidence media-upload contract with stable media IDs and contract-matching fixtures.
- [x] Add system photo-library selection with image resizing, quality reduction, a three-image limit, supported MIME validation and an 8 MB per-file limit.
- [x] Add per-file upload progress, retry, removal, cancellation and picker permission/error handling to the return flow.
- [x] Require successfully uploaded media IDs for evidence-required returns and verify those IDs when the return is created.
- [x] Validate the return-evidence upload milestone with 92 tests, quiet lint, an Android production Metro bundle and a native Android debug build.
- [x] Define validated review-list, summary, eligibility, creation, editing and deletion contracts with moderation and action policies.
- [x] Add stateful review fixtures enforcing delivered-order eligibility, verified-purchase attribution and one review per order item.
- [x] Replace seeded account and product reviews with shared RTK Query data, loading, retry, refresh and empty states.
- [x] Connect delivered order items to review creation and expose only backend-authorized edit and delete actions.
- [x] Add optional review-photo uploads with selection limits, optimization, progress, removal and media-ID validation.
- [x] Validate the reviews-and-ratings milestone with 98 tests, quiet lint and an Android production Metro bundle.
- [x] Define validated product/my-question lists, question detail, answer creation and helpfulness contracts.
- [x] Add stateful Q&A fixtures with stable IDs, pagination, moderation, author roles and idempotent helpful votes.
- [x] Replace seeded Questions and Question Detail screens with RTK Query loading, retry, refresh, empty and submission states.
- [x] Connect product detail to public Q&A while preserving the account-level question history route.
- [x] Validate the Questions & Answers milestone with 105 tests, quiet lint and an Android production Metro bundle.
- [x] Define validated customer profile read/update contracts with masked contacts, verification state and server field errors.
- [x] Add a stateful `/me` fixture that persists profile fields while keeping verified contact details authoritative.
- [x] Replace hardcoded Edit Profile identity data with RTK Query loading, retry, validation and save states.
- [x] Add profile-photo selection and upload through the shared validated media pipeline.
- [x] Model email/phone changes as pending verification challenges without replacing current verified contacts.
- [x] Use the shared profile cache for the customer name shown on the account screen.
- [x] Validate the customer-profile milestone with 112 tests, quiet lint and an Android production Metro bundle.
- [x] Define persistent communication-preference, privacy-export and account-deletion eligibility/request contracts.
- [x] Add stateful privacy fixtures with cross-device preferences, idempotent exports and explicit deletion blockers.
- [x] Add a protected Communication Preferences screen and expose it through the Privacy Center.
- [x] Replace local export completion with server request status, processing deadlines and secure-link readiness.
- [x] Replace the inert deletion button with blocker presentation, acknowledgement and scheduled deletion requests.
- [x] Validate the communication/privacy milestone with 120 tests, quiet lint and an Android production Metro bundle.
- [x] Define wallet-summary, paginated-ledger, gift-card redemption and customer-referral contracts using integer paise.
- [x] Add stateful wallet fixtures with expiry buckets, resulting balances, idempotent card redemption and server-generated referral links.
- [x] Remove `WalletContext`, client balance mutations and the unsupported wallet top-up payment branch.
- [x] Remove unsupported add-money, send, scan and coin-redemption actions from the wallet experience.
- [x] Replace seeded wallet/referral values with RTK Query loading, retry, refresh, ledger and program states.
- [x] Connect gift-card redemption to a validated server mutation that creates the corresponding ledger transaction.
- [x] Validate the wallet/gift-card/referral milestone with 128 tests, quiet lint and an Android production Metro bundle.
- [x] Define validated notification inbox, read/read-all, preference and device-token registration contracts.
- [x] Add deduplicating notification fixtures with pagination, unread totals, persistent preferences and token rotation.
- [x] Replace seeded notification state with RTK Query loading, retry, refresh, read and empty states.
- [x] Restrict notification navigation to allowlisted entity targets instead of accepting arbitrary URLs.
- [x] Persist device registrations, rotate tokens idempotently and unregister the stored device during logout cleanup.
- [x] Surface native push-permission state honestly while retaining the functional in-app inbox.
- [x] Validate the notification foundation with 136 tests, quiet lint and an Android production Metro bundle.
- [ ] Configure production FCM/APNs credentials and native permission/token callbacks when deployment accounts are available.
- [x] Define validated support-subject, ticket list/detail/create/reply and SLA contracts.
- [x] Add stateful ticket fixtures with order requirements, reply eligibility, message author types and attachment validation.
- [x] Replace seeded ticket history, random local IDs and local-only replies with shared RTK Query entities.
- [x] Add support-photo selection and upload through the shared media pipeline.
- [x] Remove the timer-simulated chatbot screen and route support entry points to persisted tickets.
- [x] Validate the support-ticket foundation with 144 tests, quiet lint and an Android production Metro bundle.
- [x] Define versioned Help Center category, article, search and article-feedback contracts.
- [x] Replace local help constants and fallback-to-first behavior with CMS queries and explicit not-found states.
- [x] Add debounced article search, published-version metadata and persisted helpfulness feedback.
- [x] Remove unsupported Plus/SuperCoins help topics from the customer-facing CMS fixture.
- [x] Validate the Help Center CMS milestone with 147 tests, quiet lint and an Android production Metro bundle.
- [ ] Complete Phase 0 product ADRs with product-owner approval.

---

## 1. Definition of “backend-ready”

The customer app is backend-ready only when all of the following are true:

1. The platform business model is frozen: Flipkart-type multi-vendor marketplace, seller/warehouse fulfilment, third-party courier last-mile (later), order lifecycle, wallet model, returns, fees, and customer-visible terminology.
2. Every supported user journey has a complete screen flow, including loading, empty, validation, offline, permission-denied, partial-success, retry, expired-session, and server-error states.
3. Screens do not own server/business state. They call feature hooks, which call implemented RTK Query endpoints and DTO mappers.
4. Every required customer endpoint has a reviewed request schema, response schema, error contract, cache policy, and example fixture.
5. Local fixture mode and live API mode expose the same contracts.
6. Authentication, refresh, persistence, logout, startup restoration, and protected navigation work end to end.
7. Cart, checkout, payment, orders, wallet, returns, support, reviews, addresses, wishlist, and notifications survive app restarts where appropriate.
8. Money is integer paise, dates are ISO-8601 UTC on the wire, IDs are opaque strings, and status enums match the admin and seller panels.
9. Critical journeys are covered by unit, component, integration, and device-level E2E tests.
10. Android and iOS release builds compile, lint and tests pass, and a backend team can implement against a versioned OpenAPI document without reading screen source code.

Passing a Metro bundle alone is not sufficient.

---

## 2. Current-state problems to eliminate

### 2.1 Architecture gaps

- `core/api`, interceptors, RTK Query base query, store setup, root reducer, middleware, persistence, network monitoring, socket client, logging, crash reporting, analytics, permissions, database/cache, and most feature API/redux files are comment-only scaffolds.
- The app root mounts seeded Cart and Wallet Context providers instead of a real store-backed data layer.
- Screens use local `useState` for server-backed data and mutate isolated copies.
- No screen currently uses RTK Query hooks or Redux dispatch.
- Feature `index.js` boundaries are mostly empty, so the documented vertical-slice architecture is not actually enforced.
- Navigation is concentrated in one root file; protected routes, auth routes, modal routes, deep links, and role/app-state routing are not implemented as designed.

### 2.2 Functional gaps

- Login, OTP, signup, password reset, payment and order placement simulate success with timers.
- Cart, wallet, addresses, orders, tickets, reviews, wishlist and notifications are seeded or transient.
- Payment creates a random local order rather than confirming a server-created order.
- Checkout calculates authoritative totals on the client.
- Wallet top-up/send/scan conflicts with the admin panel’s store-credit model.
- Customer order states conflict with the admin/seller marketplace lifecycle.
- First-party rider documentation must not be treated as the fulfilment model; last-mile is third-party courier later.
- Customer content still contains Flipkart, Myntra, Plus and SuperCoins references.
- Several actions have no reliable success, error or retry handling.
- At least one runtime defect exists in checkout (`haptics` referenced without an import).

### 2.3 Quality and tooling gaps

- No customer tests exist.
- The configured lint command fails before linting source.
- The `web` script references Expo web packages that are not installed.
- There is no Detox/Maestro/Appium device E2E setup.
- There is no API schema validation or contract test suite.
- There is no accessibility audit, performance budget, visual regression process, or release checklist.

---

## 3. Locked execution principles

These rules apply throughout the work:

- UI components never call Axios directly.
- Screen -> feature hook -> RTK Query/Redux -> base API is the only server-data path.
- RTK Query owns server state. Redux slices own durable client-only state. Local component state is limited to temporary presentation state.
- React Context is limited to presentation infrastructure such as theme and transient toast coordination; it does not own cart, wallet, authentication, orders or profile data.
- The backend is authoritative for prices, discounts, delivery fees, platform fees, stock, serviceability, payment status, wallet balance, order status and refund amounts.
- The customer app may display a preview, but must reconcile against server totals before payment.
- Mock and live modes use identical DTOs and errors.
- All mutations that move money or create orders accept an idempotency key.
- Every mutation defines cache invalidation and optimistic-update behaviour explicitly.
- Do not expose admin/seller internal statuses directly. Use a shared mapping to customer-visible statuses.
- Never place secrets, payment credentials or production environment values in the app bundle.

---

## 4. Phase 0 — product and domain freeze

This phase blocks checkout, order, fulfilment and wallet contract work. It does not block fixing tooling or building the API foundation.

### 4.1 Decide the commerce model

Locked decision: Flipkart-type multi-vendor marketplace. Last-mile delivery is **not** an owned rider fleet. Third-party courier integrations will be added later.

Document and approve:

- Whether one cart can contain multiple sellers.
- Whether an order contains seller groups and multiple shipments.
- Whether fulfilment is seller-fulfilled, platform-fulfilled, or both.
- Which third-party courier partners and tracking contracts to use when last-mile ships.
- Whether inventory is seller stock, warehouse stock, or both.
- How the buy-box offer is selected and locked during checkout.
- Which entity owns price, stock, delivery promise, tax and return policy.

Deliverable: `docs/decisions/ADR-001-commerce-and-fulfilment-model.md`.

### 4.2 Freeze the customer order lifecycle

Adopt one canonical backend lifecycle aligned with admin and seller:

- `PENDING_PAYMENT`
- `CONFIRMED`
- `PROCESSING`
- `PACKED`
- `READY_TO_SHIP`
- `SHIPPED`
- `IN_TRANSIT`
- `OUT_FOR_DELIVERY`
- `DELIVERED`
- `CANCELLED`
- `RETURN_REQUESTED`
- `RETURN_APPROVED`
- `RETURN_PICKED_UP`
- `RETURN_RECEIVED`
- `RETURN_QC_PASSED`
- `RETURN_QC_FAILED`
- `REFUND_PENDING`
- `REFUNDED`
- `RTO_INITIATED`
- `RTO_DELIVERED`
- `LOST`

Define:

- Order-level status derivation from item and shipment statuses.
- Customer-visible labels and descriptions.
- Allowed actions per state: cancel, track, return, replace, download invoice, contact support, review.
- Partial cancellation, split shipment, partial delivery and partial return presentation.
- ETA and delayed-delivery rules.
- Timeline event schema.

Deliverable: shared status catalog consumable by customer, seller and admin.

### 4.3 Freeze the wallet model

Recommended initial model: store credit only.

Decide explicitly:

- Remove Add Money, Send and Scan & Pay for MVP, or commit to a regulated payment-wallet scope.
- Allowed credits: refund, cashback, gift card redemption, referral reward and admin adjustment.
- Allowed debits: eligible order payment only.
- Expiry rules and which balance buckets expire.
- Whether balance can be combined with another payment method.
- Whether wallet can go negative—recommended: never.
- Ledger immutability, balance derivation and transaction labels.

Deliverable: `ADR-002-customer-wallet.md` and final wallet screen requirements.

### 4.4 Freeze commercial configuration

Obtain product/business decisions for:

- Delivery fee and free-delivery threshold.
- Platform/handling fee.
- COD eligibility and maximum amount.
- Return/replacement windows by category.
- Cancellation cut-off rules.
- Coupon stacking policy.
- Gift card and wallet combination policy.
- Tax-inclusive versus tax-exclusive price display.
- Rounding policy.
- Refund destination preference and fallback.
- Serviceable pincodes and promised delivery calculation.

### 4.5 Rebrand and terminology freeze

- Replace Flipkart, Myntra, Plus and SuperCoins references.
- Rename “Sell on Flipkart” to “Sell on Arise”.
- Replace cloned support email/domain values.
- Decide whether “Arise Assured” is the approved badge name.
- Create a terminology glossary shared by all panels.
- Confirm legal entity name, privacy contact, grievance officer and customer-support contact placeholders.

#### Phase 0 exit criteria

- Product owner signs off ADRs.
- Customer-visible statuses map to admin/seller statuses.
- Wallet and fulfilment contradictions are resolved.
- No backend schema work proceeds on unresolved alternatives.

---

## 5. Phase 1 — restore the engineering foundation

### 5.1 Repair package and scripts

- Fix ESLint dependencies/configuration so `npm run lint` executes successfully.
- Add `lint:ci` with zero warnings.
- Decide whether web is supported:
  - If yes, install and configure Expo/React Native Web properly and test it.
  - If no, remove the misleading `web` script and document Android/iOS-only support.
- Add `typecheck` only if migrating to TypeScript; otherwise add JSDoc checking for API DTOs.
- Pin a supported Node version compatible with React Native 0.76.
- Validate `package-lock.json` through clean `npm ci`.
- Add CI commands for lint, unit tests, integration tests and release bundle generation.

### 5.2 Implement environment configuration

Implement `env.config.js` with validated variables:

- `API_BASE_URL`
- `API_TIMEOUT_MS`
- `APP_ENV`
- `ENABLE_API_MOCKS`
- `SENTRY_DSN`
- `ANALYTICS_ENABLED`
- `PAYMENT_PROVIDER`
- `MAPS_PROVIDER`
- `SOCKET_URL`

Requirements:

- Fail fast on missing required production configuration.
- Never include server secrets.
- Expose an environment label in non-production builds.
- Maintain development, test, staging and production examples.

### 5.3 Implement the core API client

Build:

- Axios instance with timeout and base URL.
- Authorization header injection.
- Stable `X-Request-Id` generation.
- App version, platform, locale, timezone and device ID headers where approved.
- Single-flight access-token refresh.
- Retry only for safe/idempotent operations and transient network failures.
- Normalized errors: `code`, `message`, `fieldErrors`, `details`, `requestId`, `retryable`.
- Idempotency-key helper for checkout/payment/order/refund-affecting requests.
- Cancellation with AbortSignal.
- Redacted development logging.
- Forced logout for invalid refresh tokens.

### 5.4 Implement RTK Query foundation

- Create one base API slice.
- Register tag types for every customer domain.
- Implement Axios base query.
- Configure polling and refetch-on-reconnect/focus policies.
- Configure serializable state appropriately.
- Set endpoint-specific cache durations.
- Add global API error listener for session expiry and maintenance mode.

Proposed tags:

`Session`, `Profile`, `Address`, `Home`, `Category`, `Product`, `Search`, `Cart`, `Checkout`, `Order`, `Shipment`, `Wishlist`, `Wallet`, `Coupon`, `Notification`, `Review`, `Question`, `Ticket`, `StaticContent`, `FeatureFlag`.

### 5.5 Implement the Redux store

- Configure store with base API reducer and middleware.
- Add client slices only for:
  - session metadata that is not server state;
  - app preferences;
  - onboarding completion;
  - search draft/history;
  - checkout UI progress when safe;
  - offline mutation queue if approved.
- Export typed-style hooks even if the codebase stays in JavaScript.
- Enable Redux DevTools only outside production.
- Add reducer reset on logout.

### 5.6 Secure persistence

- Store refresh token in Keychain/Keystore, not plain MMKV.
- Store non-sensitive preferences and lightweight cache metadata in MMKV.
- Do not persist raw card, OTP, CVV, bank or sensitive profile data.
- Version persisted state and implement migrations.
- Add explicit cache clearing on logout/account deletion.
- Add first-launch and restored-session boot states.

### 5.7 Network, offline and startup infrastructure

- Implement connectivity listener.
- Add global offline banner.
- Define read-cache behaviour per feature.
- Prevent unsafe money mutations while offline.
- Queue only explicitly approved idempotent mutations.
- Implement startup orchestration:
  1. load secure session;
  2. load preferences;
  3. refresh token if needed;
  4. fetch app config/maintenance/version;
  5. resolve onboarding/auth destination;
  6. render navigation.

### 5.8 Logging, crash and analytics foundation

- Implement structured logger with PII redaction.
- Integrate crash reporting behind environment config.
- Define analytics event naming and ownership.
- Prevent analytics from collecting addresses, message bodies, OTPs or payment data.
- Add screen-view tracking from navigation.

#### Phase 1 exit criteria

- Clean install succeeds.
- Lint passes.
- Store and API client unit tests pass.
- Session refresh works under concurrent 401 responses.
- Cold-start restoration and logout clearing are tested.
- The app can switch between fixture and live API modes without screen changes.

---

## 6. Phase 2 — API contract and fixture platform

### 6.1 Contract conventions

Align with the admin/seller conventions:

- Base: `/api/customer/v1`.
- Success envelope: `{ data, meta? }`.
- Error envelope: `{ error: { code, message, fieldErrors?, details?, requestId } }`.
- List pagination: `page`, `pageSize`, `total`, `hasNext`.
- Sort syntax and filter conventions must be common across panels.
- Money: integer paise.
- Dates: ISO-8601 UTC.
- Locale/timezone are presentation concerns.
- Mutations return the updated resource or command result—not only `success: true`.
- Version status enums and never silently change their meaning.

### 6.2 Create the customer OpenAPI document

Create `docs/api/customer-v1.openapi.yaml` containing:

- Authentication and security schemes.
- All endpoint paths.
- Request/response schemas.
- Status enums.
- Common pagination and error schemas.
- Examples for happy, empty, validation, conflict and permission cases.
- Idempotency-header requirements.
- Webhook/realtime event payloads that the app consumes.

### 6.3 Add runtime schema validation

- Use Zod for external response validation in fixture/QA builds.
- Define DTO schemas near each feature API.
- Map DTOs into stable app models.
- Do not let screen components depend on raw backend field names.
- Add contract tests verifying fixtures against schemas.

### 6.4 Build a real customer fixture API

Recommended: use MSW for web/tests and a React Native-compatible mock adapter or local fixture transport for native development.

Requirements:

- Reuse the same seeded platform model where practical.
- Customer catalog/orders must correspond to seller/admin entities.
- Deterministic seed.
- Simulated latency and error injection.
- Support session expiry, stock conflicts, price changes, failed payments, partial shipments and refund delays.
- No screen should import fixture data directly.

### 6.5 Contract inventory

For every endpoint record:

- Owning feature.
- Screen consumers.
- Request DTO.
- Response DTO.
- Required auth.
- Cache tags.
- Retry policy.
- Idempotency requirement.
- Empty/error states.
- Admin/seller source of truth.
- Backend implementation status.

#### Phase 2 exit criteria

- OpenAPI validates.
- Every UI flow is backed by a documented endpoint or explicitly client-only state.
- Fixture responses pass schema validation.
- No customer screen imports mock domain data directly.

---

## 7. Phase 3 — navigation, authentication and account boot

### 7.1 Navigation restructuring

- Implement separate Auth, Customer, Modal and root orchestration navigators.
- Remove comment-only navigator files by either implementing or deleting them.
- Define route names centrally.
- Add deep-link configuration for products, categories, campaigns, orders, returns, tickets and password reset.
- Add guarded navigation for authenticated routes.
- Handle deleted/invalid deep-link entities with a recoverable state.
- Add navigation-state tests.

### 7.2 Authentication contracts

Minimum endpoints:

- `POST /auth/start`
- `POST /auth/verify-otp`
- `POST /auth/resend-otp`
- `POST /auth/signup`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /auth/session`
- `POST /auth/password/forgot` and reset endpoints only if password login remains supported.

Decide whether login is OTP-only, password-based, or both. Do not retain password screens without a supported product path.

### 7.3 Authentication UI completion

- Identifier validation for Indian phone/email rules.
- OTP length, expiry, resend countdown and attempt limits.
- Autofill/OTP paste support.
- Wrong-code, expired-code, throttled, blocked and account-not-found states.
- New-user versus returning-user branching.
- Consent capture with versioned Terms/Privacy links.
- Session-expired modal preserving safe navigation intent.
- Logout and logout-all-devices.

### 7.4 Onboarding and app boot

- Persist onboarding completion.
- Fetch onboarding slides from CMS with bundled fallback.
- Respect app maintenance and minimum-version config.
- Handle offline first launch.
- Add optional language selection to the first-run flow.

#### Phase 3 tests

- Login success and failure.
- OTP resend/expiry/lockout.
- Concurrent token refresh.
- Cold-start authenticated and anonymous routing.
- Deep link before and after authentication.
- Logout cache clearing.

---

## 8. Phase 4 — catalog, home, discovery and product detail

### 8.1 Home

Endpoints:

- `GET /home`
- `GET /home/sections/:id/items`
- `GET /app-config`
- `GET /feature-flags`

Work:

- Replace `homeData.js` with CMS response mapping.
- Render only supported section types.
- Add skeleton, empty, per-section failure and full-page retry states.
- Handle scheduled/hidden content server-side.
- Add pull-to-refresh.
- Add impression/click analytics without storing PII.

### 8.2 Categories and brands

Endpoints:

- `GET /categories/tree`
- `GET /categories/:id`
- `GET /brands`
- `GET /brands/:id/products`

Work:

- Replace static category data.
- Support category-specific filters and attributes.
- Add missing-image fallback.
- Handle hidden/deleted category deep links.

### 8.3 Search

Endpoints:

- `GET /search/suggestions`
- `GET /search/products`
- `GET /search/recent`
- `POST /search/recent`
- `DELETE /search/recent`

Work:

- Debounced cancellable suggestions.
- Server-driven filters, facets, sort options and result counts.
- Recent search persistence.
- Empty, corrected-query, blocked-term and redirect behaviour.
- Pagination and deduplication.
- Voice search permission/error states if retained.

### 8.4 Product detail

Endpoints:

- `GET /products/:id`
- `GET /products/:id/offers`
- `GET /products/:id/recommendations`
- `GET /products/:id/delivery-promise?pincode=`

Required model:

- Shared product content.
- Variants.
- Seller offers.
- Buy-box winner.
- Price/MRP/tax.
- Stock and quantity limits.
- Media.
- attributes/specifications.
- seller rating and fulfilment type.
- delivery promise.
- return policy.
- rating summary and review preview.

Work:

- Replace hardcoded product/review content.
- Preserve selected variant across offer and delivery checks.
- Disable purchase when stock/serviceability changes.
- Show price-change and offer-change reconciliation.
- Add image failure and media accessibility support.

### 8.5 Offers, flash sales and recently viewed

- Connect offer pages to campaigns/deals returned by CMS/marketing APIs.
- Treat schedules as server-authoritative.
- Store recently viewed server-side for logged-in users and locally for guests, then merge after login.
- Remove copied-brand tab identifiers such as `flipkart`.

#### Phase 4 exit criteria

- Browse -> search -> product -> variant -> delivery promise works exclusively through fixture APIs.
- All list states and pagination are tested.
- Product data matches admin/seller catalog semantics.

---

## 9. Phase 5 — cart, wishlist, coupons and checkout

### 9.1 Cart architecture

Endpoints:

- `GET /cart`
- `POST /cart/items`
- `PATCH /cart/items/:id`
- `DELETE /cart/items/:id`
- `POST /cart/items/:id/save-for-later`
- `POST /cart/saved/:id/move-to-cart`
- `POST /cart/merge`
- `POST /cart/reprice`

Rules:

- Server owns cart price, availability, quantity limits and offer identity.
- Guest cart may be local but must use the same model and merge deterministically on login.
- Cart item identity includes product, variant and selected offer—not only product ID.
- Multi-seller grouping and delivery grouping must be visible.

Work:

- Replace `CartContext` and `SEED_CART_ITEMS`.
- Add optimistic quantity updates with rollback.
- Surface removed offer, seller suspension, out-of-stock, quantity reduction and price-change conflicts.
- Prevent checkout until blocking cart issues are resolved.

### 9.2 Wishlist

Endpoints:

- `GET /wishlist`
- `POST /wishlist/items`
- `DELETE /wishlist/items/:productId`
- `POST /wishlist/:productId/move-to-cart`

Support guest-to-account merge and unavailable product states.

### 9.3 Coupon evaluation

Endpoints:

- `GET /coupons/eligible?cartId=`
- `POST /cart/coupon`
- `DELETE /cart/coupon`

The backend must run the same evaluator used by admin coupon testing. The customer must never calculate eligibility independently.

Required failures:

- expired;
- not started;
- usage exhausted;
- customer limit reached;
- minimum basket not reached;
- segment mismatch;
- seller/category/product exclusion;
- payment-method restriction;
- conflict after cart change.

### 9.4 Addresses and serviceability

Endpoints:

- CRUD `/addresses`.
- `POST /addresses/validate`.
- `GET /serviceability?pincode=`.

Work:

- Replace seeded default address.
- Validate pincode, phone and required fields.
- Support default address atomically.
- Add map/location only if approved; do not block manual address entry.
- Define what happens when a saved pincode becomes unserviceable.

### 9.5 Checkout session

Endpoints:

- `POST /checkout/sessions`
- `GET /checkout/sessions/:id`
- `PATCH /checkout/sessions/:id/address`
- `PATCH /checkout/sessions/:id/payment-method`
- `POST /checkout/sessions/:id/revalidate`

The checkout response owns:

- final line items;
- seller/shipment groups;
- taxes;
- discounts;
- coupon allocation;
- delivery fee;
- platform/handling fee;
- wallet credit;
- grand total;
- delivery promises;
- allowed payment methods;
- COD eligibility;
- expiration time;
- warnings and blockers.

Remove hardcoded fee and total calculations from the screen.

### 9.6 Payment and order creation

Endpoints:

- `POST /checkout/sessions/:id/payment-intent`
- `POST /payments/:id/confirm`
- `GET /payments/:id`
- `POST /orders` with checkout session and idempotency key.
- `GET /order-attempts/:id` for safe recovery after timeouts.

Required flows:

- UPI intent/collect as supported by provider.
- Card/tokenized provider flow; never collect/store raw card data in app-owned storage.
- COD.
- Wallet plus another method if approved.
- Payment success, failure, pending, cancelled and unknown.
- App killed during payment.
- Duplicate tap/retry.
- Paid but order-create response timed out.
- Price/stock changed immediately before confirmation.

Never generate order IDs or authoritative order objects locally.

#### Phase 5 exit criteria

- Guest and authenticated cart work.
- Cart merge is deterministic.
- Checkout totals come only from the server contract.
- Duplicate payment/order requests cannot create duplicate orders.
- Device E2E covers a successful order and at least three failure/recovery paths.

---

## 10. Phase 6 — orders, tracking, cancellation and returns

### 10.1 Order history and detail

Endpoints:

- `GET /orders`
- `GET /orders/:id`
- `GET /orders/:id/timeline`
- `GET /orders/:id/invoice`

UI requirements:

- Pagination and status/date filters.
- Multi-seller item grouping.
- Split shipments.
- Partial cancellation/return/refund.
- Reorder with unavailable-item resolution.
- Correct action availability per item—not only per order.
- Accessible customer-visible status timeline.

### 10.2 Tracking

Endpoints/events:

- `GET /shipments/:id/tracking`.
- Realtime event channel or documented polling policy.

Work:

- Courier events, ETA, delay and delivery-attempt presentation.
- Map only when a legitimate live-location source exists.
- OTP display rules and redaction.
- No fabricated rider position.
- Polling fallback, app-background behaviour and battery budget.

### 10.3 Cancellation

Endpoints:

- `GET /orders/:id/cancellable-items`
- `POST /orders/:id/cancellations`
- `GET /cancellations/:id`

Work:

- Fetch server-managed reasons.
- Allow item-level quantity where supported.
- Show refund preview before confirmation.
- Handle refund pending approval without undoing cancellation.
- Handle race with packing/shipping.

### 10.4 Returns and replacements

Endpoints:

- `GET /orders/:id/returnable-items`
- `POST /returns`
- `GET /returns/:id`
- `POST /returns/:id/cancel`
- media upload endpoints.

Work:

- Server-managed reason lists with fault attribution hidden from customers.
- Eligibility and window calculation from backend.
- Refund versus replacement options.
- Evidence upload with compression, retry and removal.
- Pickup address/time selection if supported.
- QC pass/fail and dispute explanation.
- Refund destination collection for COD when needed.

### 10.5 Reviews and Q&A

Endpoints:

- product review list/summary;
- create/edit/delete review within policy;
- media upload;
- questions list/create;
- answers list/helpfulness.

Rules:

- Verified-purchase status comes from backend.
- Moderation status and rejected reasons are explicit.
- Prevent duplicate review per order item.
- Do not render seeded fake authors.

#### Phase 6 exit criteria

- Order state mapping matches seller/admin actions.
- Partial and split cases are covered by integration tests.
- Cancel and return reasons come from the same master data as admin.
- Tracking never fabricates unavailable realtime data.

---

## 11. Phase 7 — profile, wallet, referrals, notifications and support

### 11.1 Profile and privacy

Endpoints:

- `GET/PATCH /me`
- profile-image upload.
- communication preferences.
- privacy export request.
- account deletion request and blocker status.

Work:

- Field validation and verification flows for changed phone/email.
- Mask sensitive fields.
- Do not imply immediate deletion when legal/financial blockers exist.
- Connect Terms, Privacy and static pages to versioned CMS content.

### 11.2 Wallet, gift cards and referral

Endpoints:

- `GET /wallet`
- `GET /wallet/transactions`
- `POST /gift-cards/redeem`
- `GET /referrals/me`
- referral share-link generation.

Work:

- Remove unsupported top-up/send/scan actions.
- Render balance from ledger-backed server response.
- Show expiry buckets when applicable.
- Paginate transactions.
- Prevent the client from directly changing balance.

### 11.3 Notifications

Endpoints:

- list notifications;
- mark read/read all;
- preferences;
- device-token registration/unregistration.

Work:

- Integrate FCM/APNs.
- Handle notification permissions and denial gracefully.
- Deep link safely from notification payloads.
- Deduplicate push and in-app records.
- Register token rotation and logout cleanup.

### 11.4 Help center and tickets

Endpoints:

- help categories/articles/search;
- ticket list/detail/create/reply;
- attachment upload;
- CSAT submission;
- live-chat session/message endpoints if retained.

Work:

- Remove unsupported Plus/SuperCoins topics.
- Fetch subjects/reasons from admin-managed content.
- Link tickets to orders/items.
- Support public reply versus system message rendering.
- Upload progress and retry.
- Ticket SLA/status presentation.
- Replace simulated chat bot replies with a documented realtime or polling contract.
- Preserve CSAT as customer-authenticated or signed one-time-link submission; do not borrow an admin API namespace.

#### Phase 7 exit criteria

- Profile/account settings persist.
- Privacy requests appear in admin.
- Wallet is ledger-backed and aligned with finance rules.
- Tickets created by customers appear in admin support queues.
- Notification deep links are tested.

---

## 12. Phase 8 — cross-cutting UX completeness

Apply these states to every feature:

### 12.1 Standard screen states

- initial loading skeleton;
- pull-to-refresh;
- paginating;
- empty with meaningful next action;
- offline with cached data;
- offline without cached data;
- retryable server error;
- non-retryable business error;
- field-level validation error;
- authentication expired;
- permission denied;
- entity deleted/unavailable;
- partial content failure;
- mutation in progress;
- mutation success confirmation;
- mutation conflict with refresh/reconcile action.

Create shared components only where behaviour is genuinely common.

### 12.2 Accessibility

- Minimum touch targets.
- Screen-reader names and hints for icons, rating stars, quantities and status timelines.
- Logical focus order.
- Dynamic font scaling without clipped actions.
- Colour contrast validation.
- Reduced-motion handling.
- Keyboard support for web only if web remains supported.
- Announce asynchronous errors and successes.

### 12.3 Localization

- Complete `en` and `hi` string extraction.
- Remove embedded user-visible strings from screens.
- Pluralization and currency/date formatting.
- Backend returns stable codes; app owns localized labels.
- Test long Hindi strings and mixed-script content.

### 12.4 Media and uploads

- Central upload service.
- Permission rationale and denied states.
- File type/size limits.
- Image compression and orientation correction.
- Progress, cancel and retry.
- Pre-signed upload flow.
- Virus/moderation processing state where relevant.

### 12.5 Performance

- FlashList for large lists where beneficial.
- Stable keys and memoized expensive rows.
- Image sizing, caching and placeholders.
- Avoid loading all tabs/screens eagerly.
- Measure cold start, home time-to-content, search response rendering and product-detail render time.
- Define budgets for JS bundle size, memory and dropped frames.

---

## 13. Phase 9 — test strategy and quality gates

### 13.1 Unit tests

Cover:

- DTO mappers.
- Money formatting and allocation display.
- Status mapping and allowed-action selectors.
- Cart merge/reconciliation.
- Checkout presentation selectors.
- Persistence migrations.
- Error normalization.
- Analytics redaction.

### 13.2 Component tests

Use React Native Testing Library for:

- Forms and validation.
- Loading/empty/error states.
- Product variant selection.
- Cart conflicts.
- Checkout repricing.
- Partial orders and returns.
- Accessibility labels and actions.

### 13.3 API integration tests

- Run feature APIs against fixture handlers.
- Validate responses with Zod.
- Assert cache invalidation and optimistic rollback.
- Test 401 refresh, 403, 404, 409, 422, 429 and 5xx behaviour.
- Test request cancellation and offline recovery.

### 13.4 Device E2E

Recommended: Maestro for broad journey coverage; use Detox if deeper React Native synchronization is required.

Required journeys:

1. First launch -> onboarding -> OTP login -> home.
2. Search -> product -> variant -> cart -> address -> payment -> order.
3. Payment pending/timeout -> app restart -> order recovery.
4. Price/stock conflict during checkout -> reconcile -> complete.
5. Order -> tracking -> delivery -> review.
6. Order -> partial cancellation -> refund pending -> refunded.
7. Delivered item -> return -> pickup -> QC -> refund.
8. Wallet credit used with another payment method, if supported.
9. Create support ticket with attachment -> admin response -> customer reply -> CSAT.
10. Expired session during a non-money mutation and during checkout.
11. Offline cached browse and prohibited offline checkout.
12. Notification deep link to order/ticket/product.

### 13.5 Cross-panel contract journeys

Automate at API level:

- Seller creates listing -> admin approves -> customer can discover it.
- Customer orders -> seller sees fulfilment work -> admin sees order.
- Seller dispatches -> customer tracking advances.
- Customer cancels/returns -> admin and seller see consistent state.
- Admin releases refund -> customer order and wallet/payment view update.
- Customer raises ticket -> admin support queue receives it.
- Admin publishes home layout/banner/help content -> customer consumes it.

### 13.6 CI gates

Every merge must pass:

- clean install;
- formatting check;
- lint with zero warnings;
- unit/component/integration tests;
- OpenAPI validation;
- fixture-schema validation;
- Android release bundle;
- iOS build in macOS CI;
- critical E2E smoke on at least Android;
- no uncommitted generated artifacts.

---

## 14. Phase 10 — security, privacy and release hardening

- Threat-model authentication, payment, deep links, uploads and account deletion.
- Certificate pinning decision based on operational ability to rotate pins.
- Root/jailbreak detection only if business risk warrants it; never treat it as sole protection.
- Secure token storage and log redaction review.
- Dependency and secret scanning.
- Rate-limit/lockout UI behaviour.
- Prevent screenshots on sensitive screens only where justified.
- Verify payment-provider compliance boundary.
- Privacy consent and analytics opt-out behaviour.
- Data-retention and cache-clearing review.
- Accessibility sign-off.
- Low-end Android performance test.
- Slow/unstable network test.
- Upgrade/migration test from the currently distributed build, if one exists.
- Store listing, privacy disclosures and support/legal information review.

---

## 15. Feature-by-feature file migration pattern

Apply this pattern to each feature instead of implementing unrelated files ad hoc:

1. Write the OpenAPI path and schemas.
2. Add fixture handlers and representative seed states.
3. Implement `<feature>.endpoints.js` constants only if they add value; otherwise avoid redundant wrappers.
4. Implement `<feature>.api.js` by injecting endpoints into the base API.
5. Implement `<feature>.mapper.js` for DTO-to-view-model conversion.
6. Implement `<feature>.query.js` hooks/selectors when the generated RTK hooks need composition.
7. Implement client-only slice state only when required.
8. Replace screen fixture imports/local server state.
9. Add all standard UI states.
10. Add mapper, API integration and component tests.
11. Add at least one cross-feature or E2E assertion.
12. Remove obsolete fixture constants and Context state.

Recommended feature order:

1. app config, auth, profile;
2. home, categories, product, search;
3. cart, wishlist, coupons, addresses;
4. checkout, payment;
5. orders, tracking, cancellation, returns;
6. wallet, referral;
7. reviews/Q&A;
8. notifications;
9. support/chat;
10. settings/privacy/static content.

---

## 16. Proposed delivery waves

Exact duration depends on team size. The sequencing is more important than the calendar estimate.

### Wave A — decisions and foundation

- Phase 0 decisions.
- Tooling repair.
- Store, API, persistence, network and session foundation.
- OpenAPI conventions and fixture transport.

No feature team should invent an endpoint before Wave A conventions are approved.

### Wave B — identity and discovery

- Auth and boot.
- Profile shell.
- Home, categories, search and product detail.
- CMS/config integration.

This produces a stable read-only customer experience and validates catalog compatibility.

### Wave C — transaction core

- Cart, wishlist, coupon, address and serviceability.
- Checkout session.
- Payment integration and idempotent order creation.

This is the highest-risk wave and requires backend participation from design time.

### Wave D — post-purchase

- Orders, shipments, tracking, cancellation, returns, refunds and reviews.
- Cross-panel state consistency.

### Wave E — engagement and care

- Wallet/referral.
- Notifications.
- Help center, tickets, live chat and CSAT.
- Privacy/account deletion.

### Wave F — production hardening

- Accessibility, localization, E2E, security, performance and release validation.
- Final backend handoff package.

---

## 17. Backend handoff package

The customer UI is declared backend-ready only when the handoff contains:

- Validated `customer-v1.openapi.yaml`.
- ERD references and ownership for customer-facing entities.
- Status/enumeration catalog.
- Error-code catalog with UI behaviour.
- Endpoint inventory with screen consumers.
- Auth/session sequence diagrams.
- Checkout/payment/order idempotency sequence diagram.
- Order/return/refund state diagrams.
- Realtime event catalog and polling fallbacks.
- Deterministic fixtures for all important states.
- Contract test suite runnable independently.
- Cross-panel journey tests.
- Environment and local-development guide.
- Backend readiness checklist signed by frontend, backend, QA and product owners.

---

## 18. Final release gate

Do not mark the customer app complete until:

- [ ] No copied Flipkart/Myntra/Plus/SuperCoins user-facing content remains.
- [ ] No screen imports domain fixtures directly.
- [ ] Cart, wallet, session, orders and profile are not stored in business-state Context providers.
- [ ] No authoritative money or status calculation exists only on the client.
- [ ] Every network screen supports loading, empty, offline and error states.
- [ ] Every mutation handles validation, conflict and retry behaviour.
- [ ] Customer statuses match admin and seller state machines.
- [ ] Customer-created orders, returns and tickets appear correctly in the other panels.
- [ ] Lint, test and Android/iOS release builds pass in CI.
- [ ] Critical device E2E journeys pass against fixture and staging APIs.
- [ ] OpenAPI and fixtures pass schema/contract validation.
- [ ] Security, privacy, accessibility and performance reviews are signed off.
- [ ] Product has approved the final commerce, fulfilment, wallet and fee rules.

When every item above is satisfied, backend implementation becomes a contract implementation exercise rather than a process of reverse-engineering incomplete screens.
