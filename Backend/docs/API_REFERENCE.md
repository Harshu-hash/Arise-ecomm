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
| `GET` | `/api/customer/v1/search` | none | Approved products (admin-LIVE, with a LIVE offer, an image and a visible category). Query: `q` (every word must match, any order), `categoryId` (whole subtree), `brandId`, `categories`, `brands` (comma lists), `priceRangeId`, `minRating`, `sort`, `cursor` (offset), `limit` (≤24). Returns cards, `total`, `nextCursor`, facets and sort options. Price is the cheapest in-stock live offer. |
| `GET` | `/api/customer/v1/products/:id` | none | Approved product detail: images, sizes/colour from variant attributes, specs, size chart, availability. 404 for anything not LIVE or in a hidden category. `rating`, `ratingCount` and `reviewCount` come from published reviews (null/0 until the first one). |
| `GET` | `/api/customer/v1/brands` | none | The Brands page: brands with at least one product on the shelf, A-Z. Query: `filter` (`All`, `Popular` = the 10 brands with most products, or a department name), `cursor` (offset), `limit` (≤ 50). Returns `{ filters, items: [{ id, name, imageUrl, offerText ('Up to N% Off' or null), category, popular }], nextCursor }`. Cached with the catalog snapshot (about 15s). |
| `GET` | `/api/customer/v1/me/recently-viewed` | Bearer JWT (customer) | The products this customer opened lately, newest first (up to 20; ones no longer on the shelf are left out): `{ items: [{ id, productId, imageUrl, title, subtitle, viewedAt }] }`. History is forgotten after 60 days. |
| `DELETE` | `/api/customer/v1/me/recently-viewed` | Bearer JWT (customer) | Clears this customer's history. |
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

Categories carry `commissionPct` (0–40, at most two decimals) or `null`: the share of a sale Arise keeps. It is **not** copied to children. A category without its own rate follows the nearest one above it, so the bottom-most set rate wins (leaf, then its parent, then the top level); no rate anywhere means 0%. `GET /api/admin/v1/categories/:id` returns the category's own `commissionPct` and `meta.inheritedCommission` (`{ pct, source: { id, name } | null }`: what it would use with no rate of its own). `PATCH` with `commissionPct: null` clears it. Setting or changing a rate (create or `PATCH`) also needs `finance.commission.edit` (`403` otherwise; resending the unchanged value is fine); `meta.allowedActions` lists `EDIT_COMMISSION` when the admin may. Tax (GST, HSN) is stored on every level, so the leaf's value is already the bottom-most.

## inventory

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/seller/v1/inventory` | Bearer JWT (seller / seller staff) | The seller's stock, one row per offer (variant): `sku`, `productTitle`, `variantLabel`, `fulfillmentType`, `sellable`, `reserved`, `available`, `lowStock` (under 10 available), `version`. Paged (`page`, `pageSize` ≤ 200), `q` (title / SKU / seller SKU), `fulfillmentType`, `lowStock=true`, `aged=true`, `sort` (`sellable`, `available`, `productTitle`, `updatedAt`; default `-sellable`). `meta.counts`: `skus`, `unitsSellable`, `lowStock`, `aged` over all the seller's stock. |
| `GET` | `/api/seller/v1/inventory/recommendations` | Bearer JWT (seller / seller staff) | Restock suggestions. Always `[]` until orders exist to give a sales velocity. |
| `GET` | `/api/seller/v1/inventory/:id/ledger` | Bearer JWT (seller / seller staff) | `{ inventory, entries }`: the latest 200 stock movements, newest first (`ADJUSTMENT` from this page, `LISTING_EDIT` from the listing form), each with `qty` and `balanceAfter`. `404` for another seller's offer. |
| `PATCH` | `/api/seller/v1/inventory/:id/stock` | Bearer JWT (seller / seller staff) + `Idempotency-Key` | `{ sellable, version, note, reference? }` sets self-ship stock and records an `ADJUSTMENT`. `409 VERSION_CONFLICT` (with `details.current`) when the row changed since `version`; `409 FBA_STOCK_IMMUTABLE` for Arise-fulfilled offers. Pushes a catalog refresh to customer apps. |

`reserved` is the units held for checkouts in progress, and `available` = `sellable` − `reserved`. A seller cannot set stock (here or in the listing form) below `reserved`: `409 RESERVED_STOCK`. Until orders, warehouses and inbound receiving exist: `daysOfCover`/`dailyVelocity`/`oldestUnitDays` are `null`, nothing is `aged`, and `warehouseCode` names the fulfilment kind ("Your warehouse" / "Arise fulfilment centre").

### Stock reservations and who may sell (internal, used by cart/checkout)

- **Who may sell:** a seller with status `APPROVED` or `ACTIVE` and holiday mode off. Anyone else's offers (suspended, under review, rejected, on holiday) are hidden from customer search, product pages, home sections and promotions, and cannot be bought. Catalog reads may lag a change by a few seconds; buying always checks the seller's current state.
- **Reservations** (`product` module: `holdStock`, `commitStock`, `releaseStock`, `expireStaleReservations`): a checkout holds all its lines or none (`409 INSUFFICIENT_STOCK`, `details.lines` lists every short line). Holds are keyed by a `reference` (checkout/order id), safe to repeat, and can join the caller's MongoDB transaction. Paying commits them (stock drops, a `SALE` ledger line is written, the offer `version` moves); abandoning releases them; unpaid holds expire (swept every minute). Committing a hold that already expired reports it in `missing` so the caller can re-hold or refund. Shoppers see `stock − reserved`.
- **Line resolution** (`cart` module: `resolveLines`): for each `{ offerId, quantity }` returns whether it can be sold now (`issueCode`: `OFFER_UNAVAILABLE`, `SELLER_UNAVAILABLE`, `OUT_OF_STOCK`, `QUANTITY_LIMIT`), the seller, the unit price and its source (`SHELF`, or `CAMPAIGN` while a campaign deal runs for that seller's product with enough deal units left for the whole quantity), and the quantity limits (`min(maxQtyPerOrder, available)`). Deal units are not held yet, so the last ones can be oversold until checkout holds them.

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
| `GET` | `/api/customer/v1/products/:productId/reviews` | none | Published reviews, newest first (`cursor`, `limit` ≤ 20) with `summary { average, count, distribution }`. |
| `GET` | `/api/customer/v1/order-items/:orderItemId/review-eligibility` | Bearer JWT (customer) | `{ eligible, reason, existingReviewId }`. Eligible once that parcel is `DELIVERED`, not already reviewed, and not refunded. `404 ORDER_ITEM_NOT_FOUND` for someone else's item. |
| `POST` | `/api/customer/v1/reviews` | Bearer JWT (customer) | `{ orderItemId, rating 1-5, title?, body 10-2000, mediaIds? (≤5, own REVIEW_MEDIA uploads) }`. Clean text with no photos is `PUBLISHED` at once; anything else is `PENDING` for an admin. `409 REVIEW_NOT_ELIGIBLE` / `REVIEW_ALREADY_EXISTS`, `422 MEDIA_INVALID`. No Idempotency-Key: the unique order item makes a repeat a 409. |
| `GET` | `/api/customer/v1/reviews/mine` | Bearer JWT (customer) | The customer's reviews in every state, with `rejectionReason` and `allowedActions`. |
| `PATCH` / `DELETE` | `/api/customer/v1/reviews/:reviewId` | Bearer JWT (owner) | Edit (re-moderated like a new review; a published one that now needs a look leaves the rating until approved) or delete (frees the item to be reviewed again). |
| `GET` | `/api/admin/v1/reviews` | Bearer JWT + `reviews.review.view` | Moderation queue: `status`, `autoModeration`, `hasMedia`, `q`, `sort=submittedAt\|rating\|helpfulVotes`; meta has status/autoModeration facets. |
| `GET` | `/api/admin/v1/reviews/:id` | Bearer JWT + `reviews.review.view` | One review plus `otherReviewsByAuthor`. |
| `POST` | `/api/admin/v1/reviews/:id/publish`, `/reject` `{ reason }`, `/hide-media`, `/flag-incentivised` | Bearer JWT + `reviews.review.moderate` | Moderation actions. Rejecting needs a reason and tells the customer. `409 NO_CHANGE` when already in that state. Audited. |
| `POST` | `/api/admin/v1/reviews/bulk` | Bearer JWT + `reviews.review.moderate` | `{ action: PUBLISH_CLEAN\|REJECT, reviewIds, reason? }` → `{ affected }`. |
| `POST` | `/api/admin/v1/reviews/:id/reply/moderate` | Bearer JWT + `reviews.review.moderate` | `{ status: PUBLISHED\|REJECTED, reason }` on a seller's pending reply (reason required to reject; the seller is notified). `409 NO_PENDING_REPLY`. Audited. |
| `GET` | `/api/admin/v1/abuse-reports` | Bearer JWT + `reviews.abuse.view` | Seller reports on reviews: `status`, `q`, `sort=reportedAt\|reporterCount`, status facets. |
| `POST` | `/api/admin/v1/abuse-reports/:id/decide` | Bearer JWT + `reviews.abuse.decide` | `{ decision: DISMISSED\|REMOVED, reason? }`. REMOVED rejects the review (out of the rating, author told). `409 ALREADY_DECIDED`. Audited. |
| `GET` | `/api/seller/v1/customer-experience/reviews` | Bearer JWT (seller) | This seller's published reviews (`rating`, `q`, `sort`), buyer masked, with their reply and latest report. Other sellers' reviews never appear. |
| `POST` | `/api/seller/v1/customer-experience/reviews/:id/reply` | Bearer JWT (seller) | `{ text ≤ 1000 }`. Public only once an admin publishes it; no phone numbers, emails or links (`400 PROHIBITED_CONTENT`). `409 REPLY_EXISTS` unless the last one was rejected. Another seller's review is `404`. |
| `POST` | `/api/seller/v1/customer-experience/reviews/:id/report` | Bearer JWT (seller) | `{ reason }` → an abuse report. `409 REPORT_EXISTS` while one is open. |
| `PUT` / `DELETE` | `/api/customer/v1/reviews/:reviewId/helpful` | Bearer JWT (customer) | Mark a published review helpful / take it back. One vote per person (a repeat changes nothing); `409 CANNOT_VOTE_OWN`. The product's review list also returns `viewerFoundHelpful` for a signed-in customer. |
| `POST` | `/api/customer/v1/reviews/:reviewId/report` | Bearer JWT (customer) | `{ reason }` flags a published review for the abuse queue (`reporterType: CUSTOMER`). `409 REPORT_EXISTS` / `CANNOT_REPORT_OWN`. |
| `GET` | `/api/customer/v1/products/:productId/questions` | optional customer Bearer | Public questions with `answersCount` and the most helpful answer as `answerPreview` (`cursor`, `limit` ≤ 20). |
| `GET` | `/api/customer/v1/questions/mine` | Bearer JWT (customer) | The customer's questions in every state, with `rejectionReason`. |
| `POST` | `/api/customer/v1/questions` | Bearer JWT (customer) | `{ productId, body 5-500 }` about a LIVE product. Clean text is public at once, the rest waits for an admin; sellers with an offer on it are notified. |
| `GET` | `/api/customer/v1/questions/:questionId` | optional customer Bearer | The question with its published answers (plus the viewer's own), most helpful first. A question that is not public is `404` unless it is the viewer's own. |
| `POST` | `/api/customer/v1/questions/:questionId/answers` | Bearer JWT (customer) | `{ body 2-2000 }`; clean text is public at once. The asker is notified when an answer goes public. |
| `PUT` / `DELETE` | `/api/customer/v1/answers/:answerId/helpful` | Bearer JWT (customer) | Helpful vote on a public answer; returns the answer with `helpfulCount` and `viewerFoundHelpful`. |
| `GET` | `/api/admin/v1/questions` | Bearer JWT + `reviews.qa.view` | Q&A queue: `status`, `unanswered`, `q`, `sort=askedAt\|answerCount`; each row has `answerCount`, `pendingSellerAnswer`, `unansweredDays`. |
| `GET` | `/api/admin/v1/questions/:id` | Bearer JWT + `reviews.qa.view` | One question with every answer. |
| `POST` | `/api/admin/v1/questions/:id/moderate` | Bearer JWT + `reviews.qa.moderate` | `{ status: PUBLISHED\|REJECTED, reason }` (reason required to reject; the asker is told). Audited. |
| `POST` | `/api/admin/v1/questions/:id/answers` | Bearer JWT + `reviews.qa.answer` | `{ text }` answers as Arise Support, public at once. |
| `POST` | `/api/admin/v1/answers/:id/moderate` | Bearer JWT + `reviews.qa.moderate` | `{ status, reason }` publishes or rejects an answer (a seller's waits here). `409 NO_CHANGE`. |
| `GET` | `/api/seller/v1/customer-experience/questions` | Bearer JWT (seller) | Public questions on this seller's products (buyer masked) with answers, `responseDueAt` (2 days) and `slaBreached` (filterable). |
| `POST` | `/api/seller/v1/customer-experience/questions/:id/answers` | Bearer JWT (seller) | `{ text }`; waits for an admin; no phone numbers, emails or links (`400 PROHIBITED_CONTENT`); `409 ANSWER_PENDING`. |

A product's rating is kept in `review_summaries` (running totals of published reviews, changed only by atomic `$inc`). A "rate your purchase" push goes once to each parcel delivered 3-14 days ago that still has an unreviewed, unrefunded item (hourly job). Deleting an account removes the customer's reviews, questions, answers, open reports and votes.

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
| `POST` | `/api/customer/v1/media/uploads` | Bearer JWT (customer) | Multipart `file` + `purpose=PROFILE_IMAGE` (JPG/PNG/WebP) or `RETURN_EVIDENCE` (image/video, private: `url` is a signed link, the `id` is the file's storage key). Returns `{ id, url, thumbnailUrl, mimeType, sizeBytes, status }`; pass `id` as `avatarMediaId`. |

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
| `POST` | `/api/customer/v1/wishlist/:productId/move-to-cart` | Bearer JWT (customer) | Puts one of the product in the cart (the cheapest seller's offer) and removes it from the wishlist: `{ productId, wishlisted: false, cartItemId }`. `404 WISHLIST_ITEM_NOT_FOUND`; when it cannot be bought the cart's error comes back (`409 PRODUCT_OUT_OF_STOCK`, `PRODUCT_UNAVAILABLE`, `404 PRODUCT_NOT_FOUND`) and it stays on the wishlist. |

## customer cart

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/customer/v1/cart` | Bearer JWT (customer) | The whole cart, priced fresh: `items`, `savedItems`, `appliedCoupon`, `totals`, `checkoutAllowed`, `issues`, `version`. Empty (version 0) for a customer with no cart. |
| `POST` | `/api/customer/v1/cart/items` | Bearer JWT (customer) | `{ offerId }` or `{ productId, variantId? }` plus `quantity` (1–100). With a product the cheapest in-stock offer from a seller who may sell is chosen. Adding an offer already in the cart adds to its quantity; adding a saved one brings it back. `201` with the cart. `404 PRODUCT_NOT_FOUND`, `409 PRODUCT_OUT_OF_STOCK`, `PRODUCT_UNAVAILABLE` (seller away), `QUANTITY_UNAVAILABLE` (`details.maximumQuantity`), `CART_FULL` (50 different items). |
| `PATCH` | `/api/customer/v1/cart/items/:cartItemId` | Bearer JWT (customer) | `{ quantity }`: the new quantity, with the same limits. `404 CART_ITEM_NOT_FOUND`. |
| `DELETE` | `/api/customer/v1/cart/items/:cartItemId` | Bearer JWT (customer) | Removes the item, in the cart or saved; removing one that is not there still succeeds. |
| `POST` | `/api/customer/v1/cart/items/:cartItemId/save-for-later` | Bearer JWT (customer) | Moves the item out of the cart (and out of the totals). `404 CART_ITEM_NOT_FOUND`. |
| `POST` | `/api/customer/v1/cart/saved/:cartItemId/move-to-cart` | Bearer JWT (customer) | Brings a saved item back, if it can still be bought. `404 SAVED_ITEM_NOT_FOUND`. |
| `POST` / `PUT` | `/api/customer/v1/cart/coupon` | Bearer JWT (customer) | `{ code }` (any case; unlisted codes work). One coupon at a time. `422 COUPON_INVALID`, `409 COUPON_MINIMUM_NOT_MET` (`details.minimumSubtotalPaise`) or `COUPON_NOT_APPLICABLE`. A refused coupon is not kept. |
| `DELETE` | `/api/customer/v1/cart/coupon` | Bearer JWT (customer) | Removes the coupon. |
| `GET` | `/api/customer/v1/coupons/eligible` | Bearer JWT (customer) | `{ items: [{ code, description, discountPaise, minimumSubtotalPaise }] }`: coupons that would save something on this cart now, best first (`?cartId` is accepted and ignored). |

### Checkout, payment and orders (customer)

Flow: `POST /checkout/sessions` -> `PUT|PATCH .../payment-method` -> `POST .../payment-intent` -> the app opens Razorpay's SDK with `providerAction.sdk` -> `POST /payments/:id/confirm` with the signed result -> `POST /orders`. If the app closes before `/orders`, Razorpay's `payment.captured` webhook places the order anyway. Placing is idempotent per checkout. All amounts are integer paise; prices are GST-inclusive.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/customer/v1/checkout/sessions` | Bearer JWT (customer) + `Idempotency-Key` | `{ source: CART \| BUY_NOW, addressId?, cartVersion?, items? }`. Prices the cart (or `items`: `{ offerId }` or `{ productId, variantId \| variantLabel }` plus `quantity`) per seller with a Shiprocket delivery quote (flat fee from Fees settings if Shiprocket is down; an unserviceable pincode is a blocker). Nothing is held yet. `409 CART_EMPTY`, `CART_CHANGED`, `CART_BLOCKED`, `CHECKOUT_UNAVAILABLE`; `404 ADDRESS_NOT_FOUND`. |
| `GET` | `/api/customer/v1/checkout/sessions/:id` | Bearer JWT (customer) | The session and its quote. `410 CHECKOUT_EXPIRED` after the payment window (Orders settings `paymentPendingTimeoutMins`, default 30). |
| `PUT` / `PATCH` | `/api/customer/v1/checkout/sessions/:id/address` | Bearer JWT (customer) | `{ addressId }`; re-quotes delivery. |
| `PUT` / `PATCH` | `/api/customer/v1/checkout/sessions/:id/payment-method` | Bearer JWT (customer) | `{ paymentMethod: upi \| card }` (COD and wallet are not available yet). |
| `POST` | `/api/customer/v1/checkout/sessions/:id/revalidate` | Bearer JWT (customer) | Re-prices with current prices, stock and delivery quotes. |
| `POST` | `/api/customer/v1/checkout/sessions/:id/payment-intent` | Bearer JWT (customer) + `Idempotency-Key` | `{ method }`. Re-prices; `409 CHECKOUT_CHANGED` (nothing charged) if the total moved, `CHECKOUT_BLOCKED`, `INSUFFICIENT_STOCK` (with `details.lines`). Otherwise holds the stock until the session expires and opens the Razorpay order: payment with `providerAction: { type: SDK, sdk: { keyId, orderId, amountPaise } }`. A retry returns the same payment. |
| `GET` | `/api/customer/v1/payments/:id` | Bearer JWT (customer) | The payment and its status (`REQUIRES_ACTION`, `SUCCEEDED`, `FAILED`). |
| `POST` | `/api/customer/v1/payments/:id/confirm` | Bearer JWT (customer) | `{ razorpayPaymentId, razorpayOrderId, razorpaySignature }`; `422` unless the signature verifies. |
| `POST` | `/api/customer/v1/orders` | Bearer JWT (customer) + `Idempotency-Key` | `{ checkoutSessionId, paymentId }`. Needs a succeeded payment (`409 PAYMENT_NOT_COMPLETED`). Creates one order with one sub-order per seller, sells the held stock, records the coupon use, empties the ordered items from the cart. If the held stock was already given away the payment is refunded: `409 ORDER_UNFULFILLABLE`. |
| `GET` | `/api/customer/v1/orders`, `/orders/:id`, `/orders/:id/timeline` | Bearer JWT (customer) | The customer's orders (cursor list), one order, its timeline. |
| `POST` | `/api/customer/v1/orders/:id/cancel` | Bearer JWT (customer) | `{ reason?, comment? }`. Before shipment only (`409 ORDER_NOT_CANCELLABLE`): stock goes back on sale, the coupon use is given back, the whole payment is refunded. Repeating is harmless. |
| `GET` | `/api/customer/v1/orders/:id/returnable-items` | Bearer JWT (customer) | Every item with `eligible`, `ineligibleReason`, `returnWindowEndsAt` and `allowedResolutions` (`["REFUND"]`; no replacements yet), plus the `reasons` (`requiresEvidence` ones need a photo), `pickupRequired` and `refundDestinations` (`["ORIGINAL_PAYMENT"]`). An item is returnable when its parcel is `DELIVERED`, within `deliveredAt` + the return days it was sold with (the product's return policy at purchase; 0 = never), and it has no open return. Orders also carry `canReturn` per item and overall. |
| `POST` | `/api/customer/v1/returns` | Bearer JWT (customer) | `{ orderId, orderItemId, resolution: "REFUND", reasonCode, pickupAddressId, evidenceMediaIds?, comment? }`. Whole line only. `409 ITEM_NOT_RETURNABLE` / `RESOLUTION_NOT_AVAILABLE`, `422 RETURN_REASON_REQUIRED` / `EVIDENCE_REQUIRED` / `EVIDENCE_INVALID` (ids must be the customer's own `RETURN_EVIDENCE` uploads, at most 5), `404 PICKUP_ADDRESS_NOT_FOUND`. One open return per item. Status starts `REQUESTED`, then the seller decides, receives and checks it (see the seller returns rows); a passed check refunds. Approval books a Shiprocket reverse pickup; `pickupWindowLabel` then names the courier and tracking number. |
| `GET` | `/api/customer/v1/returns/:id` | Bearer JWT (customer) | The return: `status`, `pickupAddressId`, `evidenceMediaIds`, `refund { status, amountPaise, destination }` (amountPaise = what the item cost after its coupon share). |
| `GET` | `/api/customer/v1/returns` | Bearer JWT (customer) | The customer's returns, newest first: `?limit&cursor` -> `{ items, total, nextCursor }` (each item is the return as above). |
| `—` | return status screen fields | — | A return also carries `orderNumber`, `productName`, `imageUrl`, `courier { name, awb }` (once the pickup is booked), `outcomeNote` (the seller's rejection reason or the QC failure notes), `canCancel` and `timeline [{ status, label, at }]`. `journey [{ status, label, state: DONE|CURRENT|PENDING|FAILED, at }]` is the progress list for the app: every step from the request to the refund (requested, approved, pickup scheduled, picked up, received, quality check, refund initiated, refund completed), with the steps still to come marked `PENDING`; a return that ended early (rejected, cancelled, failed QC) lists what happened and ends in `FAILED`. Order items carry `returnId` and `returnStatus` (their open return, if any). Every step a return takes sends the socket event `return:changed { returnId, orderId, status }` to the customer, the seller and admin consoles (hint only: refetch).
| `POST` | `/api/customer/v1/returns/:id/cancel` | Bearer JWT (customer) | Withdraws a return until the courier has collected the item (`REQUESTED`, `APPROVED`, `PICKUP_SCHEDULED`; `409 RETURN_NOT_CANCELLABLE` after). A booked pickup is cancelled on Shiprocket (a seller who had approved it is told); if Shiprocket refuses, the withdrawal still stands and the booking is flagged on the return (`reverse.cancelError`) for ops. The item can be returned again while its window is open. Repeating is harmless. A pickup that lapses (see the deadline job) is cancelled on Shiprocket the same way. When Shiprocket refuses, the platform support address (Settings > General) is emailed once; the return shows in the admin list with `?needsAttention=true` (rows carry `pickupCancelFailed`, the detail `meta.pickupCancelError`), and `POST /api/admin/v1/returns/:id/cancel-pickup` (`orders.return.reschedule`, audited) retries it, answering with Shiprocket's reason if it still fails. |
| `GET` | `/api/seller/v1/returns` | Bearer JWT (seller) | The seller's return requests in the panel's shape: `?page&pageSize&q&sort&stage=REQUESTED\|IN_PROGRESS\|COMPLETED`; `meta.counts` per stage. Statuses use the panel's words (`RETURN_REQUESTED`, `RETURN_APPROVED`, `RETURN_REJECTED`, `RETURN_CANCELLED`; the rest unchanged). |
| `GET` | `/api/seller/v1/returns/:id` | Bearer JWT (seller) | The return with `customerEvidence` (signed links), `policy.decisionDueAt` / `decisionOverdue`, `timeline`, and `actions` (what the seller may do now: `approve`, `reject`, `receive`, `qc`). Another seller's return is `404`. |
| `POST` | `/api/seller/v1/returns/:id/approve`, `/reject`, `/receive`, `/qc` | Bearer JWT (seller) | `reject` `{ reasonCode, reason }` (final: the item cannot be returned again; the customer sees the reason). `approve` also books the courier: Shiprocket collects the item from the customer's pickup address and delivers it to the seller's (reverse shipment; the return goes `PICKUP_SCHEDULED` with `pickupAwb` / `reverseCourierName`). If booking fails the approval stands and `actions` offers `schedule-pickup` (`POST /:id/schedule-pickup`), which resumes where it stopped. Shiprocket's tracking webhook then moves the return itself: picked up -> `PICKED_UP`, delivered -> `RECEIVED`; `receive` stays as the seller's manual fallback. `qc` `{ result: PASS\|FAIL, reasonCode?, notes }`: a FAIL needs `reasonCode` and `notes`. Repeating the same action is harmless; a wrong-state call is `409 ILLEGAL_TRANSITION`. The customer is notified at each step and the seller's bell gets a "New return request". A PASS restocks the item (ledger type `RETURN`), refunds the customer the item's price only (no delivery or platform fee) to the original payment, and credits that line of the invoice with a credit note; the return goes `REFUND_INITIATED` and then `REFUND_COMPLETED` (when Razorpay's refund webhook says processed; the panel shows these as `QC_PASSED` and `CLOSED`). If the refund fails the return stays `QC_PASSED`; repeating the QC call retries it. Seller evidence uploads are not stored. A seller who has not decided by `policy.decisionDueAt` (48 hours after the request) loses the say: every 15 minutes the maintenance job `returns.decision-deadline` approves the return for them (event by `SYSTEM`), books the courier and tells the seller ("Return approved automatically") and the customer. Likewise a return the seller has not checked by `policy.qcDueAt` (72 hours after the item reached them; `qcOverdue` flags it) is auto-passed by the same job: restocked, the customer refunded, the invoice line credited (event by `SYSTEM`) and the seller told ("Return accepted automatically"). The same job looks after pickups: an approval whose courier could not be booked is booked again after 15 minutes (resuming where it stopped); a booked pickup not collected by `policy.pickupDueAt` (5 days) is chased once (Shiprocket is asked again, 3 more days); if it is still not collected the return lapses to `CANCELLED` (event by `SYSTEM`, the customer told, the item can be requested again while its window is open). |
| `GET` | `/api/admin/v1/returns`, `/returns/:id` | Bearer JWT + `orders.return.view` | Every seller's returns in the console's shape (the seller panel's status words): `?page&pageSize&sort&q&status=<comma list>&sellerId&faultAttribution&reason&qcResult&requestedAt[gte]&requestedAt[lte]`; `meta.facets.status`. The detail adds `meta.allowedActions` (only what this admin may do: `APPROVE`, `REJECT`, `SCHEDULE_PICKUP`, `MARK_RECEIVED`, `RECORD_QC`, `OVERRIDE_REJECTION`), `item.deliveredAt` / `returnWindowEndsAt`, `refund` and the QC checklist. |
| `POST` | `/api/admin/v1/returns/:id/approve`, `/reject`, `/schedule-pickup`, `/mark-received`, `/qc`, `/override-rejection` | Bearer JWT + `orders.return.approve` / `.reject` / `.reschedule` / `.mark_received` / `.qc` (override needs `.approve`) | The same actions the seller has, plus `override-rejection { reason }`, which reopens a seller-rejected return (approved and the courier booked). Each is audited (`orders.return.<action>`) and returns the refreshed detail. There is no convert-to-refund: returns are refund-only. `POST /api/admin/v1/returns/:id/retry-refund` (`orders.return.qc`, button `RETRY_REFUND`, offered when the refund after a passed QC was refused) tries the refund again without ever paying twice; the detail's `meta.refund.failureReason` shows Razorpay's own reason. `POST /api/admin/v1/returns/:id/cancel { reason }` (`orders.return.reject`, button `CANCEL_RETURN`) cancels a return that the courier has not collected yet (`REQUESTED`, `APPROVED`, `PICKUP_SCHEDULED`) or one that was rejected: it is closed with no refund, a booked pickup is cancelled on Shiprocket, the item can be requested again while its window is open, and the customer (with the reason) and the seller are told. Later stages answer `409 ILLEGAL_TRANSITION`. |
| `POST` | `/api/admin/v1/orders/:id/items/:itemId/return` | Bearer JWT + `orders.item.return_initiate` | `{ reason (a reason code or its label), type?, comments? }`. Raises a refund return for the customer (same eligibility, no photo needed, collected from their default address; `REPLACEMENT` is `409 RESOLUTION_NOT_AVAILABLE`). Order detail items now carry `returnId` and `returnEligibility`, the order `meta.returns`, and order rows `hasReturn`. |

### Seller orders and shipping

A seller works *parcels*: their own part (sub-order) of a customer order, scoped by their account. Statuses: `CONFIRMED` (new) -> `ACCEPTED` -> `READY_TO_SHIP` -> `SHIPPED` -> `IN_TRANSIT` -> `OUT_FOR_DELIVERY` -> `DELIVERED` (also `DELIVERY_FAILED`, `RTO`, `RTO_DELIVERED`, `CANCELLED`). `RTO_DELIVERED` (courier says the undelivered parcel is back with the seller, or an admin sets it) restores the stock, refunds the customer the items' price only (delivery and platform fees stay), credits the invoice's goods lines, and no longer holds the order back (all parcels returned = order `CANCELLED`). It is final, like `CANCELLED`. The customer's order status follows its slowest live parcel. Courier progress arrives from Shiprocket (never from the seller).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/seller/v1/orders` | Bearer JWT (seller) | The seller's parcels: `?page&pageSize&q&sort&stage=NEW\|PROCESSING\|SHIPPED\|DELIVERED\|RTO\|CANCELLED&status=`; `meta.counts` per stage plus `breaching` (past the dispatch-by time). Customer phone is masked here. |
| `GET` | `/api/seller/v1/orders/:id` | Bearer JWT (seller) | One parcel with the full address, price details, history and the shipping label. `404` for another seller's parcel. |
| `POST` | `/api/seller/v1/orders/:id/confirm` | Bearer JWT (seller) | Accept (`CONFIRMED` -> `ACCEPTED`). Repeating is harmless. |
| `POST` | `/api/seller/v1/orders/:id/ready-to-ship` | Bearer JWT (seller) | From `ACCEPTED`: registers the seller's pickup address on Shiprocket (first time), creates the shipment, assigns the courier and tracking number, makes the label and requests the pickup, then `READY_TO_SHIP`. Each step is saved, so after a Shiprocket failure (`502 SHIPPING_PROVIDER_ERROR` with Shiprocket's reason) clicking again resumes. `409 PICKUP_ADDRESS_INCOMPLETE` if the store address, phone or email is missing. |
| `POST` | `/api/seller/v1/orders/:id/cancel` | Bearer JWT (seller) | `{ reason? }`. Only before ready to ship (`409 NOT_CANCELLABLE` after). Stock goes back, the customer is refunded this parcel's amount. |
| `POST` | `/api/seller/v1/orders/bulk` | Bearer JWT (seller) | `{ action: confirm \| ready-to-ship, selection: { mode: SELECTED, ids } \| { mode: FILTERED, filters } }` -> `{ done, failed, failures }`. |
| `GET` | `/api/customer/v1/shipments/:shipmentId/tracking` | Bearer JWT (customer) | `{ status, awb, courierName, estimatedDeliveryDays, events }` for a parcel of their own order (the order's items carry `shipmentId`). |
| `POST` | `/webhooks/v1/shipping/shiprocket` | `x-api-key: SHIPROCKET_WEBHOOK_TOKEN` | Shiprocket tracking updates (set this URL and token in Shiprocket's dashboard). Stored once per event, processed in the background; old or unknown updates never move a parcel backwards. |

A customer cancelling (`POST /orders/:id/cancel`) is allowed only while no live parcel is past `ACCEPTED`; parts a seller already cancelled stay cancelled and were already refunded.

### Notifications

Order events (placed, ready to ship, shipped, out for delivery, delivered, delivery failed, returning, cancelled in part or whole, sold out after payment) create an in-app message for the customer, a Firebase push to their registered phones and, for the main ones, an email. Sellers get new-order and customer-cancelled alerts in their panel bell. Each message is keyed by its event, so a repeated event never notifies twice. Sending never fails the order action it describes. Pushes need `FCM_SERVICE_ACCOUNT_JSON`; without it they are skipped.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/customer/v1/notifications` | Bearer JWT (customer) | `?limit&cursor` -> `{ items, unreadCount, total, nextCursor }`, newest first. Each item: `category` (ORDER, DELIVERY, OFFER, ACCOUNT, SUPPORT), `title`, `body`, `readAt`, `target: { type, entityId }`. |
| `PUT` | `/api/customer/v1/notifications/:id/read` | Bearer JWT (customer) | Marks one read (keeps the first read time). `404` if it is not theirs. |
| `PUT` | `/api/customer/v1/notifications/read-all` | Bearer JWT (customer) | Marks every one read. |
| `GET` / `PATCH` | `/api/customer/v1/notifications/preferences` | Bearer JWT (customer) | `{ orders, delivery, offers, account, support, pushPermission }`. A category switched off stops its pushes; the in-app list and order emails are unaffected. |
| `POST` | `/api/customer/v1/devices/push-tokens` | Bearer JWT (customer) | `{ deviceId, token, platform: android \| ios }`: registers this phone's Firebase token (registering again updates it). A token Firebase rejects is dropped automatically. |
| `DELETE` | `/api/customer/v1/devices/push-tokens/:deviceId` | Bearer JWT (customer) | Stops pushes to this phone (sign-out). |
| `GET` | `/api/seller/v1/dashboard/alerts` | Bearer JWT (seller) | The panel's header bell: `[{ id, title, body, at, severity, link, read }]` with `meta.unread`. |
| `POST` | `/api/seller/v1/dashboard/alerts/:key/read` | Bearer JWT (seller) | Marks one alert (by its `id`) read. |

### Live order updates and admin orders

Every committed order change (placed, accepted, ready to ship, each courier step, cancelled in part or whole) is pushed over the existing socket (`/socket.io`, JWT in `auth.token`) as `order:changed` `{ orderId, status, at }` to: the customer's own room, each seller in that order, and the admin room. `notification:changed` `{ at }` goes to the recipient of a new notification. These are hints only: screens refetch over HTTP, and every (re)connect sends `session:ready`, on which clients refetch, so a missed hint never leaves a screen stale. The customer app, the seller panel (orders list, order detail, alerts bell) and the admin console (orders list, order detail) subscribe.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/admin/v1/orders` | Bearer JWT (admin) + `orders.order.view` | Every order: `?page&pageSize&sort=placedAt\|grandTotalPaise\|status\|customerName\|slaDueAt&q&status=a,b&paymentMethod&sellerId&state&city&pincode&couponCode&slaBreached&placedAt[gte]&placedAt[lte]`. `id` is the order number. `meta.facets.status` counts per status over everything but the status filter (the tabs). |
| `GET` | `/api/admin/v1/orders/:id` | Bearer JWT (admin) + `orders.order.view` | `:id` is the order number or id. `data`: the row plus `priceDetails` and `address`. `meta`: `items`, `shipments` (one per seller parcel, with courier and tracking number), `payments`, `refunds`, `events` (newest first), `customer`; `allowedActions` is empty (read-only). |

How the cart works:

- **Only choices are stored** (which offers, quantities, saved for later, a coupon code), one cart per customer. Every read and every change prices each line again through the same check checkout uses (`resolveLines`), so the cart can never show something checkout would refuse.
- **Totals** (integer paise): `subtotal` = unit prices × quantities of the lines that can be bought (a running campaign deal price counts); `productDiscount` = MRP − subtotal; delivery = the admin setting `fees.deliveryFeePaise`, free from `deliveryFeeFreeThresholdPaise` (checkout replaces it with a shipping quote); platform fee = `fees.platformFeePaise` (not on an empty cart); `payable` = subtotal − coupon + delivery + platform. Delivery coupons only take off the delivery fee; others never more than the subtotal.
- **Lines with a problem** (`issueCode`: `OFFER_UNAVAILABLE`, `SELLER_UNAVAILABLE`, `OUT_OF_STOCK`, `QUANTITY_LIMIT`) are not charged for, come back with `available`/`issueCode`, and add a blocking entry to `issues`, so `checkoutAllowed` is false until they are fixed or removed. Other `issues` are non-blocking: `PRICE_CHANGED` (shown once, until the customer next changes the cart) and `COUPON_REMOVED` / `COUPON_NOT_APPLICABLE` (the coupon stopped applying; a change that breaks it drops it).
- **Concurrent changes** (two devices): each change is saved only if the cart is still the version it started from, and is retried from the new state otherwise, so none is lost; if that keeps failing the response is `409 CART_BUSY` (retryable).
- A change that is refused leaves the cart exactly as it was. Coupons are judged by the same rule as the admin coupon tester. Until orders exist every customer counts as a first-time buyer who has redeemed nothing, so first-order and per-customer limits are not enforced yet; checkout must pass the real counts.

## customer privacy

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/customer/v1/privacy/deletion-eligibility` | Bearer JWT (customer) | Returns real blockers from implemented commerce domains and any existing deletion request. |
| `POST` | `/api/customer/v1/privacy/deletion-request` | Bearer JWT (customer) | `{ reasonCode, acknowledged: true }` schedules one idempotent deletion request after a seven-day cooling period. |

The maintenance worker completes due requests every 15 minutes. It revokes sessions, removes verification challenges, addresses, recent product views, the wishlist and avatar files, and anonymizes the customer identity while retaining its opaque id and request record for referential/legal history.

## search

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/customer/v1/search/suggestions` | none | `?q=` → `{ suggestions, trending, prompts }`. `suggestions`: up to 5 matching product names (`type: arrow`, tap to search), then up to 2 brands and 2 categories that match a typed word (`type: chevron`), each with an image. `trending`: the most searched queries of the last 7 days (searched at least twice, results found), topped up with the shelf's biggest brands and departments. `prompts`: related searches built from the matches' brands and categories ("Puma shoe"); every one finds products. Empty `q` gives no suggestions, only `trending`. |
| `GET` | `/api/customer/v1/search/recent` | Bearer JWT (customer) | `{ items: [text] }`: this customer's last 8 searches, newest first. |
| `POST` | `/api/customer/v1/search/recent` | Bearer JWT (customer) | `{ query }` remembers a search (a repeat moves to the top; the newest 20 are kept for 90 days). Contact details, very short or very long text are ignored. Returns the list. |
| `DELETE` | `/api/customer/v1/search/recent` | Bearer JWT (customer) | Clears the history (also cleared when the account is deleted). |

Product search (`GET /search`, listed under catalog) matches **every word** of `q` in any order against the name, brand and category (`nike shoes` = `shoes nike`). `sort=relevance` puts the best name/brand match first and sold-out items last; `sort=popularity` ranks by units sold in the last 90 days (refreshed every 10 minutes); `sort=rating` ranks by average rating. A typed search that finds something counts toward trending (first page only, no customer is recorded). Not built: spell correction, synonyms, and searching descriptions.

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
