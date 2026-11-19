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
| `POST` | `/api/customer/v1/auth/start` | none | Starts a customer login, signup, or password-reset OTP challenge for an email or Indian mobile number. |
| `POST` | `/api/customer/v1/auth/resend-otp` | none | Replaces a live customer OTP challenge after the resend delay. |
| `POST` | `/api/customer/v1/auth/verify-otp` | none | Verifies a login/signup OTP, creates the customer when needed, and returns access and rotating refresh tokens. |
| `POST` | `/api/customer/v1/auth/signup` | none | Completes a signup OTP challenge; compatibility alias for clients that separate signup verification. |
| `POST` | `/api/customer/v1/auth/password/verify-otp` | none | Exchanges a verified password-reset OTP for a short-lived reset token. |
| `POST` | `/api/customer/v1/auth/password/reset` | reset token | Changes the customer password and revokes existing sessions. |
| `POST` | `/api/customer/v1/auth/refresh` | refresh token in JSON or cookie | Rotates a customer refresh token and returns the refreshed mobile session. |
| `GET` | `/api/customer/v1/auth/session` | Bearer JWT | Returns the current customer session profile. |
| `POST` | `/api/customer/v1/auth/logout` | refresh token in JSON or cookie | Revokes one customer session. |
| `POST` | `/api/customer/v1/auth/logout-all` | Bearer JWT | Revokes every session belonging to the customer. |
| `GET` | `/api/customer/v1/app-config` | none | Supplies the minimum app version, maintenance state, store links, and bootstrap feature flags required before customer navigation starts. |
| `GET` | `/api/customer/v1/home` | none | Returns the customer home feed; currently an empty valid feed so real-backend authentication can run before catalog modules land. |
| `GET` | `/api/admin/v1/roles` | Bearer JWT + `admin.role.view` | Paginated role list (`q`, `system`, `hasUsers`, `sort`, `page`, `pageSize`) with admin and permission counts. |
| `GET` | `/api/admin/v1/roles/:id` | Bearer JWT + `admin.role.view` | One role plus the admins that hold it and the actions allowed on it. |
| `POST` | `/api/admin/v1/roles` | Bearer JWT + `admin.role.create` | Creates a custom role from catalog permissions (implied `view` keys are added). Audited. |
| `POST` | `/api/admin/v1/roles/:id/clone` | Bearer JWT + `admin.role.create` | Creates an editable copy of any role (Super Admin's wildcard is expanded to explicit keys). |
| `PATCH` | `/api/admin/v1/roles/:id` | Bearer JWT + `admin.role.edit` | Edits a custom role under optimistic `version`; system roles are refused; holders' permissions are re-synced. Audited. |
| `DELETE` | `/api/admin/v1/roles/:id` | Bearer JWT + `admin.role.delete` | Deletes a custom role not held by any admin (`ROLE_IN_USE` otherwise). Audited. |
| `GET` | `/api/admin/v1/admin-users` | Bearer JWT + `admin.user.view` | Paginated admin list (`q`, `status`, `roleId`, `twoFactorEnrolled`, date ranges, `sort`) with status facets. |
| `GET` | `/api/admin/v1/admin-users/:id` | Bearer JWT + `admin.user.view` | One admin with active sessions and the lifecycle actions the caller may take. |
| `POST` | `/api/admin/v1/admin-users` | Bearer JWT + `admin.user.invite` | Invites an admin with one or more roles and an optional data scope; permissions are the union of the roles. Audited. |
| `PATCH` | `/api/admin/v1/admin-users/:id` | Bearer JWT + `admin.user.edit` | Edits name, roles, scope or landing page under optimistic `version`; cannot change own roles or demote the last Super Admin. Audited. |
| `POST` | `/api/admin/v1/admin-users/:id/deactivate` | Bearer JWT + `admin.user.deactivate` | Deactivates an active admin (reason required) and revokes all their sessions; not self, not the last Super Admin. |
| `POST` | `/api/admin/v1/admin-users/:id/reactivate` | Bearer JWT + `admin.user.edit` | Reactivates a deactivated admin and forces a password change. |
| `POST` | `/api/admin/v1/admin-users/:id/resend-invite` | Bearer JWT + `admin.user.invite` | Issues a fresh invite link for a still-pending admin. |
| `POST` | `/api/admin/v1/admin-users/:id/revoke-sessions` | Bearer JWT + `admin.user.revoke_session` | Signs an admin out of one session (`sessionId`) or all devices. |

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
| `GET` | `/api/admin/v1/campaigns` | Bearer JWT + `marketing.campaign.view` | Paginated promotional campaigns (`q`, `type`, `status`, `sort`) with entry counters and status facets. |
| `POST` | `/api/admin/v1/campaigns` | Bearer JWT + `marketing.campaign.create` | Creates a campaign as a DRAFT (schedule validated). Audited. |
| `GET` | `/api/admin/v1/campaigns/:id` | Bearer JWT + `marketing.campaign.view` | One campaign with its entry counters. |
| `PATCH` | `/api/admin/v1/campaigns/:id` | Bearer JWT + `marketing.campaign.edit` | Edits a campaign that is not ended or cancelled. Audited. |
| `POST` | `/api/admin/v1/campaigns/:id/status` | Bearer JWT + `marketing.campaign.edit (`.cancel` for CANCELLED)` | Moves a campaign along the state machine DRAFT→OPEN→SCHEDULED→ACTIVE⇄PAUSED→ENDED; illegal moves return `ILLEGAL_TRANSITION`. |
| `GET` | `/api/admin/v1/campaigns/:id/submissions` | Bearer JWT + `marketing.campaign.view` | Paginated seller product entries for a campaign (`q`, `status`, `sort`) with status facets. |
| `POST` | `/api/admin/v1/campaigns/:id/submissions/decision` | Bearer JWT + `marketing.campaign.edit` | Approves, rejects or requests changes on one or many PENDING entries; approval needs the campaign minimum discount. Returns `{ updated, skipped }`. |

## review

| Method | Path | Auth | Purpose |
|---|---|---|---|

## notification

| Method | Path | Auth | Purpose |
|---|---|---|---|

## admin

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/admin/v1/admin/settings` | Bearer JWT + `admin.settings.view` | All ten platform settings sections (stored values over defaults) with version and last editor. |
| `PATCH` | `/api/admin/v1/admin/settings/:sectionId` | Bearer JWT + `admin.settings.edit` | Validates and saves one section; `fees`, `approvalThresholds` and `security` require a `reason`. Audited. |
| `GET` | `/api/admin/v1/banners` | Bearer JWT + `cms.banner.view` | Paginated banners (`q`, `kind`, `status`, `sort`) with status/kind facets; status is derived from the schedule. |
| `POST` | `/api/admin/v1/banners` | Bearer JWT + `cms.banner.create` | Creates a banner; images must be URLs returned by the `CMS_MEDIA` upload. Audited. |
| `PATCH` | `/api/admin/v1/banners/:id` | Bearer JWT + `cms.banner.edit` | Edits a banner (name, images, alt text, placements, schedule). Audited. |
| `DELETE` | `/api/admin/v1/banners/:id` | Bearer JWT + `cms.banner.delete` | Removes a banner immediately. Audited. |

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
