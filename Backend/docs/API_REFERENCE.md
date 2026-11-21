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
| `GET` | `/api/customer/v1/home` | optional customer Bearer | Home feed. `header.categoryTabs` are the ACTIVE top-level categories. `?categoryId=` serves that tab's page (hero banners, paid carousel `PROMO_CAROUSEL`, products). The main For You page also returns `RECENTLY_VIEWED` ("Still looking for these?", only when a signed-in customer has opened products), `SUGGESTED_PRODUCTS` (their viewed categories first, best discounts next) and `BRAND_SPOTLIGHT` (top 3 brands by live products, with their best discount). Pages are cached for 15s per category; the recently-viewed list is per customer and not cached. |
| `GET` | `/api/customer/v1/search` | none | Approved products (admin-LIVE, with a LIVE offer, an image and a visible category). Query: `q`, `categoryId` (whole subtree), `brandId`, `categories`, `brands` (comma lists), `priceRangeId`, `minRating`, `sort`, `cursor` (offset), `limit` (≤24). Returns cards, `total`, `nextCursor`, facets and sort options. Price is the cheapest in-stock live offer. |
| `GET` | `/api/customer/v1/products/:id` | none | Approved product detail: images, sizes/colour from variant attributes, specs, size chart, availability. 404 for anything not LIVE or in a hidden category. Ratings/reviews are empty until a reviews module exists. |
| `GET` | `/api/customer/v1/categories/tree` | none | ACTIVE top-level categories (`id`, `name`, `imageUrl`, `icon`) for the "All Categories" sidebar. |
| `GET` | `/api/customer/v1/categories/:id` | none | Category pane: hero banner (its image) and sections — level-2 groups with their level-3 tiles. 404 when missing or hidden (a hidden parent hides its subtree). |
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
| `GET` | `/api/admin/v1/customers` | Bearer JWT + `customers.customer.view` | Paginated customers (`q`, `status`=ACTIVE/BLOCKED/DELETED, `joinedAt[gte|lte]`, `sort`) with status facets. |
| `GET` | `/api/admin/v1/customers/:id` | Bearer JWT + `customers.customer.view` | One customer; order/wallet/risk figures are zero placeholders until those modules exist. |
| `POST` | `/api/admin/v1/customers/:id/block` | Bearer JWT + `customers.customer.block` | Suspends an active customer and signs them out everywhere. Audited. |
| `POST` | `/api/admin/v1/customers/:id/unblock` | Bearer JWT + `customers.customer.block` | Reactivates a blocked customer. Audited. |

## user

| Method | Path | Auth | Purpose |
|---|---|---|---|

## seller

| Method | Path | Auth | Purpose |
|---|---|---|---|

## catalog / category / product

| Method | Path | Auth | Purpose |
|---|---|---|---|

Categories carry `commissionPct` (0–40, at most two decimals, default 0): the share of a sale Arise keeps on listings in that category. A new child copies its parent's rate, like the other policies; later edits to a parent do not change existing children. Setting it on create, or changing it on `PATCH /api/admin/v1/categories/:id`, also needs `finance.commission.edit` (`403` otherwise; resending the unchanged rate is fine). `GET /api/admin/v1/categories/:id` lists `EDIT_COMMISSION` in `meta.allowedActions` when the admin may change it.

## inventory

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/seller/v1/inventory` | Bearer JWT (seller / seller staff) | The seller's stock, one row per offer (variant): `sku`, `productTitle`, `variantLabel`, `fulfillmentType`, `sellable`, `reserved`, `available`, `lowStock` (under 10 available), `version`. Paged (`page`, `pageSize` ≤ 200), `q` (title / SKU / seller SKU), `fulfillmentType`, `lowStock=true`, `aged=true`, `sort` (`sellable`, `available`, `productTitle`, `updatedAt`; default `-sellable`). `meta.counts`: `skus`, `unitsSellable`, `lowStock`, `aged` over all the seller's stock. |
| `GET` | `/api/seller/v1/inventory/recommendations` | Bearer JWT (seller / seller staff) | Restock suggestions. Always `[]` until orders exist to give a sales velocity. |
| `GET` | `/api/seller/v1/inventory/:id/ledger` | Bearer JWT (seller / seller staff) | `{ inventory, entries }`: the latest 200 stock movements, newest first (`ADJUSTMENT` from this page, `LISTING_EDIT` from the listing form), each with `qty` and `balanceAfter`. `404` for another seller's offer. |
| `PATCH` | `/api/seller/v1/inventory/:id/stock` | Bearer JWT (seller / seller staff) + `Idempotency-Key` | `{ sellable, version, note, reference? }` sets self-ship stock and records an `ADJUSTMENT`. `409 VERSION_CONFLICT` (with `details.current`) when the row changed since `version`; `409 FBA_STOCK_IMMUTABLE` for Arise-fulfilled offers. Pushes a catalog refresh to customer apps. |

Until orders, warehouses and inbound receiving exist: `reserved` is 0 (so `available` = `sellable`), `daysOfCover`/`dailyVelocity`/`oldestUnitDays` are `null`, nothing is `aged`, and `warehouseCode` names the fulfilment kind ("Your warehouse" / "Arise fulfilment centre").

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

### coupons and deals (admin marketing console)

Status is never stored: coupons derive it from state, schedule and usage; deals from their schedule. Money is integer paise. Writes push `marketing:changed` to the `admin` socket room (clients refetch).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/admin/v1/coupons` | Bearer JWT + `marketing.coupon.view` | Paginated coupons (`q`, `type`, `status`, `fundedBy`, `sort` incl. `budgetBurnPct`) with status/type facets. |
| `POST` | `/api/admin/v1/coupons` | Bearer JWT + `marketing.coupon.create` | Creates a live coupon. Code is upper-cased and unique; fields of other discount types are cleared; schedule, limits, budget and a custom audience (real active customers) are validated. Audited. |
| `GET` | `/api/admin/v1/coupons/:id` | Bearer JWT + `marketing.coupon.view` | One coupon with `performance` (redemptions/discount given come from checkout counters; GMV and new customers stay 0 until orders exist) and `redemptions` (empty until orders exist). |
| `PATCH` | `/api/admin/v1/coupons/:id` | Bearer JWT + `marketing.coupon.edit` | Edits an unfinished coupon; the start only before it starts; the discount only before its first redemption. Saving a DRAFT (a clone) makes it live. Audited. |
| `POST` | `/api/admin/v1/coupons/:id/pause` | Bearer JWT + `marketing.coupon.pause` | Toggles pause/resume (ACTIVE or SCHEDULED ⇄ PAUSED). |
| `POST` | `/api/admin/v1/coupons/:id/end` | Bearer JWT + `marketing.coupon.pause` | Ends an open coupon now; cannot be undone (clone it to run again). |
| `POST` | `/api/admin/v1/coupons/:id/clone` | Bearer JWT + `marketing.coupon.create` | Copies a coupon as a DRAFT with a fresh code and dates starting now. |
| `POST` | `/api/admin/v1/coupons/:id/test` | Bearer JWT + `marketing.coupon.view` | Runs the shared evaluator for a customer and live products at today's shelf prices: `{ applicable, reasons, discountPaise, ... }`. |
| `POST` | `/api/admin/v1/campaigns/reach` | Bearer JWT + `marketing.coupon.view` or `marketing.campaign.view` | `{ reach }` customers an audience (`ALL`, `NEW`, `CUSTOM`) would reach. Segments are not built yet. |
| `GET` | `/api/seller/v1/coupons` | Bearer JWT (seller or staff) | The seller's own coupons only (`q`, `status`, `sort`, paging) with status facets; pushes `coupon:changed` to the seller room on any change. |
| `POST` | `/api/seller/v1/coupons` | Bearer JWT (seller owner) | Creates a seller-funded coupon (percent, flat or free delivery; no audience/budget/stacking). Applies to that seller's items only. Code is unique across the platform. Audited. |
| `POST` | `/api/seller/v1/coupons/:id/pause`, `/resume`, `/end` | Bearer JWT (seller owner) | Explicit pause, resume, or end (final). Another seller's coupon is `404`. Audited. |
| `GET` | `/api/admin/v1/deals` | Bearer JWT + `marketing.deal.view` | Paginated deals (`q`, `placement`, `tag`, `status`, `sort`) with status/placement/tag facets. |
| `GET` | `/api/admin/v1/deals/calendar` | Bearer JWT + `marketing.deal.view` | Deals holding a Deal-of-the-Day slot from today (India) onward. |
| `POST` | `/api/admin/v1/deals` | Bearer JWT + `marketing.deal.create` | Builds a deal on a LIVE product's cheapest in-stock offer; the deal price must undercut it, the end must be ≤ 90 days out, the slot day (optional) must fall inside the run and be free (`409 SLOT_TAKEN`). Audited. |
| `POST` | `/api/admin/v1/deals/:id/reschedule` | Bearer JWT + `marketing.deal.edit` | Moves a deal's slot day; if another deal holds it the two swap when legal. Returns `{ moved, swappedWith }`. Audited. |
| `DELETE` | `/api/admin/v1/deals/:id` | Bearer JWT + `marketing.deal.delete` | Removes a deal. Audited. |

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

### content (home layout, header tabs, static pages)

Writes push `cms:changed` to the `admin` socket room. Once a home layout is published, `GET /api/customer/v1/home` (For You page only) shows only its enabled sections, in its order; before that the built-in sections are unchanged. The app keeps hero banners and shop banner ads pinned at the top. Each home flash sale and each Top Value Deals campaign is its own `FLASH_SALE` / `TOP_VALUE_DEALS` section (`campaignId`, one item), placed by its own layout row; a campaign put on the home page after the last publish shows after the last one of its kind until it is placed. Header category/brand tabs follow the console's label, colour, order and visibility.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/admin/v1/cms/home/draft` | Bearer JWT + `cms.home.view` | The editable draft (created from the published layout on first use), with one `FLASH_SALE_BANNER` / `TOP_VALUE_DEALS` row per campaign currently on the home page (each with its `campaign`: name, status, dates); rows of campaigns that left are dropped. |
| `PATCH` | `/api/admin/v1/cms/home/draft` | Bearer JWT + `cms.home.edit` | Replaces the draft's sections (known types, an optional item limit 1–30 where it applies; `FLASH_SALE_BANNER`/`TOP_VALUE_DEALS` rows need a `campaignId` and appear once per campaign, every other type once; ≤ 100). Not audited (autosave). |
| `GET` | `/api/admin/v1/cms/home/published` | Bearer JWT + `cms.home.view` | The published layout in the shape the app consumes; `404` until something is published. |
| `GET` | `/api/admin/v1/cms/home/versions` | Bearer JWT + `cms.home.view` | Latest 50 versions (DRAFT / PUBLISHED / ARCHIVED) with any pending rollback request. |
| `POST` | `/api/admin/v1/cms/home/publish` | Bearer JWT + `cms.home.publish` | Publishes the draft (at least one section on), archives the previous one and opens a fresh draft. `201`. Audited. |
| `POST` | `/api/admin/v1/cms/home/rollback` | Bearer JWT + `cms.home.rollback` | Requests a rollback to an archived version (reason required, one pending at a time). `202`: nothing changes until another admin approves. |
| `POST` | `/api/admin/v1/cms/home/versions/:id/rollback/approve` | Bearer JWT + `cms.home.rollback` | A different admin than the requester approves; the version goes live. `403` for the requester. Audited. |
| `POST` | `/api/admin/v1/cms/home/versions/:id/rollback/reject` | Bearer JWT + `cms.home.rollback` | Rejects (or the requester withdraws) a pending rollback. Audited. |
| `GET` | `/api/admin/v1/cms/category-tabs` | Bearer JWT + `cms.home.view` | One tab per customer-visible root category (new categories appear last). |
| `PATCH` | `/api/admin/v1/cms/category-tabs/reorder` | Bearer JWT + `cms.home.edit` | `{ orderedIds }` — every tab exactly once. Audited. |
| `PATCH` | `/api/admin/v1/cms/category-tabs/:id` | Bearer JWT + `cms.home.edit` | Label, icon, two hex gradient colours, layout variant, visibility. Audited. |
| `GET` | `/api/admin/v1/cms/brand-tabs` | Bearer JWT + `cms.home.view` | The home header's brand switch. |
| `PATCH` | `/api/admin/v1/cms/brand-tabs/:id` | Bearer JWT + `cms.home.edit` | Label, logo URL, target, visibility. Audited. |
| `GET` | `/api/admin/v1/static-pages` | Bearer JWT + `cms.page.view` | About, Privacy, Terms, Return, Shipping and Seller policy pages (version history without bodies). |
| `GET` | `/api/admin/v1/static-pages/:id` | Bearer JWT + `cms.page.view` | One page with its body. |
| `PATCH` | `/api/admin/v1/static-pages/:id` | Bearer JWT + `cms.page.publish` | Publishes a new body (1–100,000 chars) as a new version; `materialChange` flags it for customer re-acceptance. Audited. |

## bannerAd

Paid shop-banner slots. Admins define named slots with a daily price; sellers rent a slot for a date range (days x daily price + 18% GST). Dates are held per day in `banner_slot_days` (unique per slot and day), so two sellers can never hold the same day. An unpaid booking keeps its dates for 15 minutes, then they free up.

Booking lifecycle: `PENDING_PAYMENT` -> (Razorpay payment confirmed) `PENDING_REVIEW` -> `APPROVED` or `REJECTED` (full refund, dates freed). Unpaid holds become `EXPIRED`. Approved bookings are shown as `SCHEDULED` / `LIVE` / `COMPLETED` by their dates.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/admin/v1/banner-ads/placements` | Bearer JWT + `ads.placement.view` | Lists slots with total and upcoming booking counts. |
| `POST` | `/api/admin/v1/banner-ads/placements` | Bearer JWT + `ads.placement.edit` | Creates a slot (name unique ignoring case, `categoryId` = the customer-app page: a header category, or `null` for For You, `dailyRatePaise`, banner pixel size (mobile), `enabled`). Audited. |
| `PATCH` | `/api/admin/v1/banner-ads/placements/:id` | Bearer JWT + `ads.placement.edit` | Edits a slot; a new price or size applies to future bookings only. Audited. |
| `DELETE` | `/api/admin/v1/banner-ads/placements/:id` | Bearer JWT + `ads.placement.edit` | Deletes a slot; `409 SLOT_HAS_BOOKINGS` once anything paid exists. Audited. |
| `GET` | `/api/admin/v1/banner-ads/requests` | Bearer JWT + `ads.review.view` | Review queue: paid bookings. `?status=`, `?q=`, `?sort=submittedAt\|totalPaise\|startsOn`. |
| `POST` | `/api/admin/v1/banner-ads/requests/:id/decide` | Bearer JWT + `ads.review.decide` | `{ decision: APPROVED\|REJECTED, reason }`. Rejecting refunds the payment through Razorpay (retry by rejecting again if the refund failed). `409 ALREADY_DECIDED`. Audited. |
| `GET` | `/api/seller/v1/banner-ads/placements` | Bearer JWT (seller) | Open slots with their anonymous `bookedRanges` for the calendar. |
| `GET` | `/api/seller/v1/banner-ads/destinations` | Bearer JWT (seller) | The seller's shop and live products a banner can open. |
| `GET` | `/api/seller/v1/banner-ads` | Bearer JWT (seller) | The seller's own bookings. |
| `GET` | `/api/seller/v1/banner-ads/:id` | Bearer JWT (seller) | One own booking. |
| `POST` | `/api/seller/v1/banner-ads` | Bearer JWT (seller) + `Idempotency-Key` | Holds the dates and opens a Razorpay order: `{ booking, payment: { providerOrderId, keyId, amountPaise } }`. The creative is mobile-only: `BANNER_AD_MOBILE` media that must match the slot's exact pixel size. `409 SLOT_BOOKED` when any day is taken. |
| `GET` | `/api/seller/v1/banner-ads/:id/payment-order` | Bearer JWT (seller) | The Razorpay order of a booking still `PENDING_PAYMENT`, to re-open checkout; `409 NOT_PAYABLE` once the hold lapsed. |
| `POST` | `/api/seller/v1/banner-ads/:id/pay` | Bearer JWT (seller) | Razorpay checkout result `{ providerPaymentId, signature }`; a valid signature moves the booking to review. The `payment.captured` webhook does the same if the seller never returns. |

## campaigns (seller entries and customer display)

Admins create campaigns (`/api/admin/v1/campaigns`, above) and move them DRAFT -> OPEN -> SCHEDULED -> ACTIVE. Sellers enter their admin-approved (LIVE) products while the campaign is OPEN and before its deadline, with a deal price (at or below their selling price, at least `minDiscountPct` off MRP) and a committed stock. The admin approves or rejects each entry. Customers see only APPROVED entries of a campaign that is OPEN, SCHEDULED or ACTIVE and inside its dates (paused, ended, cancelled and draft ones never show), at the deal price, and only while the product itself is still customer-visible.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/seller/v1/campaigns` | Bearer JWT (seller) | Campaigns open to join or running, plus past ones this seller entered. `?tab=all\|open\|joined`, `?q=`, `?type=`. Each row has `myProducts` / `myLiveProducts`. |
| `GET` | `/api/seller/v1/campaigns/:id` | Bearer JWT (seller) | One campaign. |
| `GET` | `/api/seller/v1/campaigns/:id/submissions` | Bearer JWT (seller) | This seller's entries with their status and the reviewer's note (`feedback`). |
| `GET` | `/api/seller/v1/campaigns/:id/eligible-listings` | Bearer JWT (seller) | The seller's live products not already pending or approved in this campaign, with MRP, selling price and stock. |
| `POST` | `/api/seller/v1/campaigns/:id/submissions` | Bearer JWT (seller) | `{ entries: [{ listingId (product id), dealPricePaise, stockCommitted }] }`. All-or-nothing; a rejected, withdrawn or changes-requested entry can be entered again. `409 ENTRIES_CLOSED` after the deadline or once the campaign leaves OPEN. |
| `POST` | `/api/seller/v1/campaigns/submissions/:id/withdraw` | Bearer JWT (seller) | Withdraws a pending, approved or changes-requested entry; it leaves the customer app at once. |
| `POST` | `/api/admin/v1/campaigns/:id/home-flash-sale` | Bearer JWT + `marketing.campaign.edit` | `{ enabled }`: shows (or stops showing) this campaign's own flash-sale banner on the home screen; any number of campaigns can be home flash sales at once, each placed on the Home layout page. Open, scheduled, live or paused campaigns only. Ending or cancelling a campaign clears it. Audited. |
| `GET` | `/api/customer/v1/flash-sales` | none | Every home flash sale running on its dates with approved products: `[{ id, title, subtitle, endsAt }]`, soonest-ending first. |
| `GET` | `/api/customer/v1/flash-sales/:id` | none | One home flash sale (the banner's `id`) with its approved products; `404` when it is not running or has none. |
| `GET` | `/api/customer/v1/promotions` | none | Every live campaign (whatever its placement) as a promotion with product tiles: the Deals tab. |
| `—` | campaign look | — | Admin campaigns also take optional `backgroundImageUrl` and `heroImageUrl` (CMS_MEDIA upload URLs) and `gradient` (`[top, bottom]` hex colours); promotions return them for the Deals card (image blended under the gradient) and the campaign page hero. |
| `GET` | `/api/customer/v1/promotions/:id` | none | One live campaign (any placement) with `relatedProducts` at the deal price. |
| `GET` | `/api/customer/v1/promotions/:id/products` | none | The campaign's approved products, paged (`cursor`, `limit`). |

`/api/customer/v1/home` also returns `FLASH_SALE` (when the admin-chosen flash sale is live; `metadata` has its title and subtitle) and `TOP_VALUE_DEALS` (one card per live `TOP_VALUE_DEALS` campaign) on the For You page.

## customer profile

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/customer/v1/me` | Bearer JWT (customer) | The customer's profile: name, masked email/phone, gender, `avatarUrl`, and any `pendingVerification` (new email/phone awaiting its code). |
| `PATCH` | `/api/customer/v1/me` | Bearer JWT (customer) | `{ name?, gender?, avatarMediaId?, newEmail?, newPhone? }`. Name, gender and photo apply at once (the photo id is the one the upload returned, and must be this customer's own upload). A new email or phone (one at a time) does not replace the current one: it sends a code to the new address and returns `pendingVerification`. `409 CONTACT_IN_USE` when another account has it. |
| `POST` | `/api/customer/v1/me/contact/verify` | Bearer JWT (customer) | `{ challengeId, otp }`: the code proves ownership and the new email/phone replaces the old one. `422 OTP_INVALID` (5 tries), `410 OTP_EXPIRED` (10 minutes). |
| `POST` | `/api/customer/v1/media/uploads` | Bearer JWT (customer) | Multipart `file` + `purpose=PROFILE_IMAGE` (JPG/PNG/WebP). Returns `{ id, url, thumbnailUrl, mimeType, sizeBytes, status }`; pass `id` as `avatarMediaId`. |

## customer addresses

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/customer/v1/addresses` | Bearer JWT (customer) | Lists only this customer's saved addresses and `defaultAddressId`. |
| `POST` | `/api/customer/v1/addresses` | Bearer JWT (customer) | Saves a serviceable address. The first address is always the default; setting another default is atomic. |
| `PATCH` | `/api/customer/v1/addresses/:addressId` | Bearer JWT (customer) | Updates the customer's address. An address cannot be changed to an unsupported pincode. |
| `DELETE` | `/api/customer/v1/addresses/:addressId` | Bearer JWT (customer) | Deletes the address; deleting the default promotes the first remaining address. |
| `POST` | `/api/customer/v1/addresses/:addressId/default` | Bearer JWT (customer) | Makes a serviceable saved address the sole default. |
| `POST` | `/api/customer/v1/addresses/validate` | Bearer JWT (customer) | Validates and normalizes address input before save; returns field errors or `409 ADDRESS_UNSERVICEABLE`. |
| `GET` | `/api/customer/v1/serviceability?pincode=380015` | Bearer JWT (customer) | Returns delivery availability, location, estimated days, and a customer message. |

## customer coupons

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/customer/v1/coupons/available` | optional customer Bearer | `{ items: [{ id, code, title, description, expiresAt, eligibilityStatus }] }`, soonest-ending first (up to 50). Only coupons usable now: live, inside their dates, not used up. Anyone sees public all-customer and first-order coupons; a signed-in customer also sees coupons made for them (even unlisted ones). Unlisted public codes never appear. `description` is the admin's text or the offer in plain words, plus "On your first order" / "Only on items from <store>". `eligibilityStatus` is `UNKNOWN`: whether a coupon fits is decided in the cart. Admin and seller coupon edits push a refresh to customer apps. |

Applying a coupon (`/cart/coupon`) is not served yet: it needs the cart backend, and will use the same `evaluateCoupon` rule as the admin's coupon tester.

## customer wishlist

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/customer/v1/wishlist` | Bearer JWT (customer) | `{ items, total }`, newest first. Each item is the search product card plus `addedAt` and `available` (in stock). A saved product that is off the shelf is left out until it is back. |
| `POST` | `/api/customer/v1/wishlist/items` | Bearer JWT (customer) | `{ productId }` saves a customer-visible product; saving it again keeps its first date. `201 { productId, wishlisted: true }`; `404 PRODUCT_NOT_FOUND` when it is not on sale. |
| `DELETE` | `/api/customer/v1/wishlist/items/:productId` | Bearer JWT (customer) | `{ productId, wishlisted: false }`, also when it was not saved. |

`POST /wishlist/:productId/move-to-cart` is not served yet: it needs the cart backend.

## customer privacy

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/customer/v1/privacy/deletion-eligibility` | Bearer JWT (customer) | Returns real blockers from implemented commerce domains and any existing deletion request. |
| `POST` | `/api/customer/v1/privacy/deletion-request` | Bearer JWT (customer) | `{ reasonCode, acknowledged: true }` schedules one idempotent deletion request after a seven-day cooling period. |

The maintenance worker completes due requests every 15 minutes. It revokes sessions, removes verification challenges, addresses, recent product views, the wishlist and avatar files, and anonymizes the customer identity while retaining its opaque id and request record for referential/legal history.

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
| `GET` | `/api/admin/v1/lookups/:entity` | Bearer JWT + the entity's view permission (or the marketing screens that use it) | Option lists for the console's searchable selects. Entities: `product` (LIVE only), `customer` (active). Query: `q`, `ids` (comma list), `limit` ≤ 50. |

## webhooks

| Method | Path | Auth | Purpose |
|---|---|---|---|
