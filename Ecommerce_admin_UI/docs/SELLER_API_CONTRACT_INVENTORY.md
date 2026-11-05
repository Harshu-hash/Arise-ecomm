# Seller API contract inventory

**Audience base:** `/api/seller/v1`  
**Version:** S18 backend handoff (2026-11-05)  
**Machine-readable foundation contract:** [`api/seller-v1.openapi.yaml`](api/seller-v1.openapi.yaml)

## Conventions

- IDs are opaque strings. Timestamps are ISO-8601 UTC. Money is integer paise.
- Success envelopes are `{ "data": ... }` or `{ "data": [], "meta": ... }`.
- Errors are `{ "error": { "code", "message", "fieldErrors?", "details?" } }` and carry `X-Request-Id`.
- UI permission names mirror policy names; handlers still enforce ownership and permission.
- Every authenticated mutation accepts `Idempotency-Key`. Replaying the same seller/key/operation returns the original resource; reusing a key with a different request hash returns `409 IDEMPOTENCY_KEY_REUSED`.
- The machine-readable contract contains 199 paths and 225 operations. A Vitest handoff gate scans production seller adapters and fails if any method/path is absent, an operation ID is duplicated, authorization metadata is missing, or a mutation loses idempotency metadata.
- Shared application operations are use-case boundaries used by seller, admin and customer adapters. They are not panel-specific business rules.

## S9 foundation endpoints

| Method and route                          | Permission                        | Request                                   | Response                                     | Principal errors                                | Idempotency           | Shared application operation                              |
| ----------------------------------------- | --------------------------------- | ----------------------------------------- | -------------------------------------------- | ----------------------------------------------- | --------------------- | --------------------------------------------------------- |
| `POST /media/uploads`                     | `media.upload.create`             | file metadata and media kind              | upload session, media ID, upload URL, expiry | `VALIDATION_FAILED`, `FORBIDDEN`                | no                    | `MediaService.createUpload` (shared customer media shape) |
| `PUT /media/uploads/{uploadId}/content`   | `media.upload.create`             | binary body                               | upload receipt                               | `UPLOAD_EXPIRED`, `NOT_FOUND`                   | retry-safe            | `MediaService.putObject`                                  |
| `POST /media/uploads/{uploadId}/complete` | `media.upload.create`             | measured dimensions                       | processing media resource                    | `UPLOAD_INCOMPLETE`, `NOT_FOUND`                | intrinsic (upload ID) | `MediaService.completeUpload`                             |
| `DELETE /media/uploads/{uploadId}`        | `media.upload.create`             | none                                      | abort receipt                                | `NOT_FOUND`                                     | intrinsic (upload ID) | `MediaService.abortUpload`                                |
| `GET /media/{mediaId}`                    | `media.media.view` + ownership    | none                                      | durable media resource                       | `NOT_FOUND`, `FORBIDDEN`                        | n/a                   | `MediaService.getMedia`                                   |
| `PATCH /media/{mediaId}`                  | `media.upload.create` + ownership | crop metadata                             | durable media resource                       | `BAD_CROP`, `NOT_FOUND`                         | no                    | `MediaService.updatePresentation`                         |
| `DELETE /media/{mediaId}`                 | `media.upload.delete` + ownership | none                                      | delete receipt                               | `NOT_FOUND`, `MEDIA_IN_USE` (live)              | intrinsic (media ID)  | `MediaService.deleteMedia`                                |
| `POST /exports`                           | `exports.job.create`              | resource, format, filtered/selected scope | export job                                   | `IDEMPOTENCY_KEY_REQUIRED`, `VALIDATION_FAILED` | **required**          | `ExportService.createJob` (admin job shape)               |
| `GET /jobs`                               | `exports.job.view` + ownership    | none                                      | seller job list                              | `FORBIDDEN`                                     | n/a                   | `ExportService.listJobs`                                  |
| `GET /jobs/{jobId}`                       | `exports.job.view` + ownership    | none                                      | job and progress                             | `NOT_FOUND`                                     | n/a                   | `ExportService.getJob`                                    |
| `GET /saved-views?tableId=`               | authenticated seller              | table ID                                  | saved views                                  | `SESSION_EXPIRED`                               | n/a                   | `ViewPreferenceService.list`                              |
| `POST /saved-views`                       | authenticated seller              | table ID, name, URL state                 | saved view                                   | `VALIDATION_FAILED`                             | no                    | `ViewPreferenceService.save`                              |
| `DELETE /saved-views/{viewId}`            | owner                             | none                                      | delete receipt                               | `NOT_FOUND`                                     | intrinsic (view ID)   | `ViewPreferenceService.delete`                            |

## S10 onboarding and verified-identity endpoints

| Method and route                                      | Permission                         | Request                                   | Response                                                | Principal errors                                      | Idempotency                   | Shared application operation                          |
| ----------------------------------------------------- | ---------------------------------- | ----------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- | ----------------------------- | ----------------------------------------------------- |
| `GET /onboarding`                                     | `onboarding.application.view`      | none                                      | application, sections, documents and agreement receipt  | `ALREADY_ACTIVE`                                      | n/a                           | `SellerApplicationService.getProjection`              |
| `PATCH /onboarding`                                   | `onboarding.application.edit`      | one section plus durable media IDs        | updated application projection                          | `UNDER_REVIEW`, `MEDIA_REQUIRED`, `VALIDATION_FAILED` | no                            | `SellerApplicationService.saveSection`                |
| `POST /onboarding/submit`                             | `onboarding.application.submit`    | none                                      | under-review application and user projection            | `INCOMPLETE`, `ILLEGAL_TRANSITION`                    | intrinsic while under review  | `SellerApplicationService.submit` used by admin queue |
| `GET /onboarding/status`                              | `onboarding.application.view`      | none                                      | section decisions, SLA, corrective actions and timeline | `NOT_FOUND`                                           | n/a                           | `SellerApplicationService.getStatus`                  |
| `POST /onboarding/sections/{sectionKey}/resubmit`     | `onboarding.application.resubmit`  | corrected durable media references        | updated status projection                               | `SECTION_NOT_EDITABLE`, `MEDIA_REQUIRED`              | intrinsic per section version | `SellerApplicationService.resubmitSection`            |
| `GET /onboarding/agreement`                           | `onboarding.agreement.view`        | none                                      | versioned, navigable agreement sections                 | `NOT_FOUND`                                           | n/a                           | `AgreementService.getCurrent`                         |
| `POST /onboarding/agreement/accept`                   | `onboarding.agreement.accept`      | agreement version                         | immutable acceptance receipt                            | `AGREEMENT_VERSION_CHANGED`                           | intrinsic per seller/version  | `AgreementService.accept`                             |
| `GET /onboarding/pincode/{pincode}`                   | `onboarding.application.edit`      | PIN code                                  | pickup serviceability                                   | `PINCODE_INVALID`                                     | n/a                           | `ServiceabilityService.checkPickup`                   |
| `POST /settings/profile/documents/{documentId}/renew` | `onboarding.document.replace`      | replacement media ID                      | pending document with version history                   | `MEDIA_REQUIRED`, `NOT_FOUND`                         | intrinsic per media ID        | `SellerIdentityService.renewDocument`                 |
| `POST /settings/profile/change-requests`              | `onboarding.change_request.create` | proposed legal name, reason, evidence IDs | admin-reviewed change request                           | `CHANGE_REQUEST_INVALID`, `CONFLICT`                  | no                            | `SellerIdentityService.requestVerifiedChange`         |

Admin document and application decisions update these same section/application records synchronously. A seller guard reads the approved application projection; no panel-specific activation flag is required.

## S11 catalogue, offers and bulk-job endpoints

| Method and route                                             | Permission              | Request                                                                          | Response                                                           | Principal errors                                             | Shared application operation             |
| ------------------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------- |
| `GET /catalog/search`                                        | `catalog.product.view`  | query, category and brand filters                                                | customer-visible canonical matches with seller-offer state         | `FORBIDDEN`                                                  | `CatalogService.searchSellableProducts`  |
| `GET /catalog/products/{productId}`                          | `catalog.product.view`  | none                                                                             | canonical content, variants and buy-box context                    | `NOT_FOUND`                                                  | `CatalogService.getSellableProduct`      |
| `POST /catalog/products/{productId}/offers`                  | `listings.offer.create` | selected variants, seller SKU, barcode, price, tax and stock                     | seller-owned offers; canonical product unchanged                   | `OFFER_EXISTS`, `PRICE_INVALID`, `BAD_VARIANT`               | `OfferService.attachOffers`              |
| `GET /listings/{listingId}`                                  | `listings.product.view` | none                                                                             | content/offer projection, quality, preview, revisions and QC state | `NOT_FOUND`                                                  | `OfferService.getSellerListing`          |
| `PATCH /listings/{listingId}`                                | `listings.product.edit` | content and durable media references                                             | direct pre-live update or pending live-content revision            | `MEDIA_NOT_DURABLE`, `CONFLICT`                              | `CatalogRevisionService.proposeRevision` |
| `PATCH /listings/{listingId}/variant`                        | `listings.product.edit` | seller SKU, barcode, tax, package dimensions and media                           | updated seller variant/offer projection                            | `MEDIA_NOT_DURABLE`                                          | `OfferService.updateVariant`             |
| `PATCH /listings/{listingId}/price`                          | `listings.price.edit`   | price, optional MRP and effective time                                           | immediate or scheduled price                                       | `VALIDATION_FAILED`                                          | `OfferService.schedulePrice`             |
| `GET /listings/{listingId}/preview`                          | `listings.product.view` | none                                                                             | customer-shaped title/media/variants/availability                  | `NOT_FOUND`                                                  | `CatalogService.getCustomerProjection`   |
| `POST /listings/{listingId}/{action}`                        | `listings.product.edit` | activate, deactivate, archive, relist, delete or resubmit; reason where required | seller offer state; canonical product preserved                    | `HAS_ORDER_HISTORY`, `PRODUCT_NOT_LIVE`, `NOT_RESUBMITTABLE` | `OfferService.transition`                |
| `POST /listings/fee-preview`                                 | `listings.price.edit`   | category, variant, selling price, shipping and cost                              | commission, fees, GST, net, margin and buy-box context             | `PREVIEW_INVALID`                                            | `FeeService.previewOfferEconomics`       |
| `GET /listings/bulk-jobs/template`                           | `listings.product.edit` | operation and optional category                                                  | operation-specific columns                                         | `VALIDATION_FAILED`                                          | `BulkListingService.getTemplate`         |
| `POST /listings/bulk-jobs/preflight`                         | `listings.product.edit` | operation and rows                                                               | row errors and warnings without writes                             | `EMPTY`                                                      | `BulkListingService.preflight`           |
| `POST /listings/bulk-jobs`                                   | `listings.product.edit` | operation and preflighted rows                                                   | completed job with per-row result/error file                       | `VALIDATION_FAILED`                                          | `BulkListingService.execute`             |
| `GET /listings/bulk-jobs`, `GET /listings/bulk-jobs/{jobId}` | `listings.product.view` | none                                                                             | seller-owned jobs and row results                                  | `NOT_FOUND`                                                  | `BulkListingService.list/get`            |
| `POST /listings/bulk-jobs/{jobId}/retry`                     | `listings.product.edit` | optional corrected failed rows                                                   | child retry job                                                    | `NOTHING_TO_RETRY`                                           | `BulkListingService.retryFailures`       |

Live content revisions remain separate from customer-visible canonical content until admin approval. Offer deactivation and deletion never remove the canonical product. Supported bulk operations are `CREATE_PRODUCTS`, `ATTACH_OFFERS`, `UPDATE_PRICE`, `UPDATE_STOCK`, and `UPDATE_CONTENT`.

## S12 dispatch, documents and logistics endpoints

| Method and route                                  | Permission                              | Request                                        | Response                                                        | Principal errors                           | Shared application operation         |
| ------------------------------------------------- | --------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------ | ------------------------------------ |
| `GET /orders/processing`                          | `logistics.shipment.view`               | queue, fulfilment and saved-view filters       | acceptance, pick, pack, handover and overdue work queues        | `FORBIDDEN`                                | `FulfilmentService.getWorkQueue`     |
| `POST /orders/{shipmentId}/packages`              | `logistics.shipment.pack`               | package item IDs, actual weight and dimensions | persisted package composition                                   | `ILLEGAL_TRANSITION`, `VALIDATION_FAILED`  | `FulfilmentService.recordPackages`   |
| `POST /orders/{shipmentId}/split`                 | `logistics.shipment.pack`               | strict subset of fulfilment item IDs           | seller-scoped child shipment                                    | `ILLEGAL_TRANSITION`, `VALIDATION_FAILED`  | `FulfilmentService.splitShipment`    |
| `POST /orders/{shipmentId}/scan`                  | `logistics.shipment.pack` or `handover` | item/SKU/EAN or AWB barcode and purpose        | immutable scan record                                           | `BARCODE_MISMATCH`, `BAD_PURPOSE`          | `FulfilmentService.recordScan`       |
| `GET /orders/{shipmentId}/documents`              | `logistics.document.view`               | none                                           | versioned fulfilment document history                           | `NOT_FOUND`                                | `FulfilmentDocumentService.list`     |
| `POST /orders/{shipmentId}/documents/{type}`      | `logistics.document.generate`           | document type                                  | immutable tax invoice, packing slip, label or manifest artifact | `DOCUMENT_NOT_READY`                       | `FulfilmentDocumentService.generate` |
| `GET /logistics/documents/{documentId}/download`  | `logistics.document.view`               | none                                           | downloadable PDF artifact                                       | `NOT_FOUND`                                | `FulfilmentDocumentService.download` |
| `POST /logistics/batch`                           | document generate or shipment handover  | selected shipment IDs and operation            | per-row success/failure result                                  | row-level illegal transition               | `FulfilmentService.executeBatch`     |
| `GET /logistics/shipments`                        | `logistics.shipment.view`               | seller-scoped filters                          | parcels, package/scan state and courier tracking                | `FORBIDDEN`                                | `ShipmentService.listForSeller`      |
| `GET /logistics/pickups`                          | `logistics.pickup.view`                 | seller-scoped filters                          | manifests and pickup attempts                                   | `FORBIDDEN`                                | `PickupService.listForSeller`        |
| `POST /logistics/pickups/{manifestId}/reschedule` | `logistics.pickup.manage`               | date and slot                                  | rescheduled pickup attempt                                      | `ALREADY_PICKED_UP`                        | `PickupService.reschedule`           |
| `GET /logistics/ndr`                              | `logistics.ndr.view`                    | status/overdue filters                         | seller-owned NDR queue with response SLA                        | `FORBIDDEN`                                | `NdrService.listForSeller`           |
| `POST /logistics/ndr/{ndrId}/respond`             | `logistics.ndr.respond`                 | reattempt/RTO decision and instructions        | shared NDR decision visible to admin                            | `NDR_SLA_EXPIRED`, `ALREADY_ACTIONED`      | `NdrService.recordSellerDecision`    |
| `GET /logistics/rto`                              | `logistics.rto.view`                    | status filters                                 | seller-owned return-to-origin tracking                          | `FORBIDDEN`                                | `ShipmentService.listRtoForSeller`   |
| `GET /logistics/weight-disputes`                  | `logistics.weight_dispute.view`         | status filters                                 | courier charges and resolution state                            | `FORBIDDEN`                                | `WeightDisputeService.listForSeller` |
| `POST /logistics/weight-disputes/{id}/dispute`    | `logistics.weight_dispute.create`       | reason and durable evidence media              | dispute visible to admin resolution                             | `DISPUTE_WINDOW_CLOSED`, `ALREADY_DECIDED` | `WeightDisputeService.dispute`       |

Shipment, item, manifest, NDR, weight-dispute and order-event records are shared with admin and customer projections. Seller endpoints enforce shipment ownership; batch operations return partial results instead of crossing seller boundaries. Generated documents are immutable versioned server artifacts.

## Existing seller resource inventory

The exact schemas for these S1-S8 resources remain implemented by their feature adapters and MSW handlers. S10-S18 must extend these families rather than introduce alternate roots.

| Route family                    | Methods               | Permission namespace                | Request / response ownership                      | Common errors                                       | Idempotency policy                           | Shared operation owner                              |
| ------------------------------- | --------------------- | ----------------------------------- | ------------------------------------------------- | --------------------------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| `/auth/*`, `/me/*`              | GET/POST/PATCH        | authenticated identity              | current seller user/session only                  | session, 2FA and validation codes                   | session/command token                        | `IdentityService`                                   |
| `/onboarding`, `/onboarding/*`  | GET/PATCH/POST        | `onboarding.*`                      | current seller application                        | validation, illegal transition, version conflict    | submission commands required in S10          | `SellerApplicationService` used by admin projection |
| `/dashboard/*`                  | GET                   | `dashboard.dashboard.view`          | seller-scoped projections                         | forbidden                                           | n/a                                          | reporting projections                               |
| `/catalog/*`                    | GET                   | `catalog.product.view`              | seller-safe canonical content                     | not found, forbidden                                | n/a                                          | canonical `CatalogService`                          |
| `/listings`, `/listings/{id}/*` | GET/POST/PATCH        | `listings.*`, `catalog.*`           | own offers; canonical content separately governed | validation, bad media, illegal transition, conflict | create/lifecycle commands required in S11    | `CatalogService` + `OfferService`                   |
| `/orders`, `/orders/{id}/*`     | GET/POST              | `orders.*`, `logistics.*`           | seller fulfilment only; masked customer data      | not found, illegal transition, forbidden            | every transition required in S12             | `FulfilmentService` shared with customer tracking   |
| `/inventory/*`, `/inbound/*`    | GET/POST/PATCH        | `inventory.*`                       | seller/location scoped stock                      | conflict, insufficient stock, illegal transition    | adjustments/inbound commands required in S13 | `InventoryService`                                  |
| `/returns/*`                    | GET/POST              | `returns.*`, `orders.return.manage` | own order items and moderated evidence            | illegal transition, deadline elapsed                | decisions/QC required in S14                 | `ReturnsService` shared with admin/customer         |
| `/finance/*`, `/invoices/*`     | GET                   | `finance.*`                         | own settlement/payout/tax records                 | not found, forbidden                                | disputes required in S15                     | `SettlementService`                                 |
| `/support/*`                    | GET/POST/PATCH        | `support.ticket.*`                  | own tickets; no admin internal notes              | validation, illegal transition                      | message submission required in S16           | `SupportService` shared with admin                  |
| `/ads/*`, `/promotions/*`       | GET/POST/PATCH        | `ads.*`, `promotions.*`             | own campaigns/nominations                         | validation, budget, illegal transition              | spend/lifecycle commands required            | `GrowthService`                                     |
| `/reports/schedules/*`          | GET/POST/PATCH/DELETE | `reports.report.view`               | own schedules                                     | validation, not found                               | delete intrinsic; create required in S17     | `ReportService`                                     |
| `/settings/*`                   | GET/PATCH/POST        | `settings.*`, `security.*`          | seller organisation only                          | validation, conflict, step-up required              | sensitive commands required in S18           | `SellerAccountService`                              |

### S13 warehouse and stock commands

| Route | Contract notes |
| --- | --- |
| `GET/POST/PATCH /settings/warehouses`, `POST /settings/warehouses/{id}/deactivate` | Seller-owned locations; mutation uses record version. Deactivation returns `WAREHOUSE_HAS_DEPENDENCIES` for active stock/orders and `PRIMARY_WAREHOUSE` until another location is primary. |
| `GET /inventory`, `GET /inventory/{id}/ledger`, `PATCH /inventory/{id}/stock` | Separates `SELLER` and `ARISE`; self-ship stock may not fall below reserved units. FBA balances are movement-only. |
| `POST /inventory/bulk-jobs`, `POST /inventory/bulk-jobs/{id}/retry` | Returns per-row outcomes; retry operates only on failed inventory IDs and retains parent job lineage. |
| `GET /inventory/recommendations`, `GET /inventory/removals` | Seller-scoped velocity/days-cover projection and removal lifecycle tracking. |
| `POST /inbound`, `POST /inbound/{id}/submit`, `GET /inbound/{id}` | Carton/pallet and appointment request data; submission creates immutable plan and carton-label artifacts; detail includes expected/received lines, documents, timeline and ledger. |
| `POST /inbound/{id}/disputes` | Allowed only after a receiving discrepancy; reason and durable media IDs are retained for admin resolution. |

### S14 return, replacement and claim commands

| Route | Contract notes |
| --- | --- |
| `GET /returns/{id}` | Seller-owned return projection containing moderated customer evidence, policy/SLA explanation, reverse-shipment data, shared events, and separately linked refund, replacement and disputes. |
| `POST /returns/{id}/reject`, `POST /returns/{id}/qc` | Decisions retain actor, timestamp, structured reason and durable evidence. Failed QC requires notes, a reason code and media and cannot create a refund. |
| `POST /returns/{id}/disputes` | Creates a separate return dispute and linked seller-protection claim; it does not mutate the customer refund/replacement state. |
| `GET /returns-analytics` | Seller-scoped aggregates by SKU/product, reason, fault attribution and financial impact. |
| `POST /claims`, `GET /claims/{id}` | Claims carry media, linked order/return/dispute entities, timeline and payout-adjustment reference. |
| `GET /finance/adjustments` | Seller-scoped payout adjustments, including identified approved-claim reimbursements. |

### S15 finance, tax and reconciliation commands

| Route | Contract notes |
| --- | --- |
| `GET /finance/reconciliation`, `GET /finance/reconciliation/{lineId}` | Seller-scoped order-to-bank trace with payout/UTR, returns, refunds, weight disputes, adjustments and finance disputes. Period/status filters and export jobs retain only non-sensitive criteria. |
| `POST /finance/reconciliation/{lineId}/disputes` | Requires a positive integer-paise amount, reason and durable media IDs. Only one unresolved dispute is allowed per line. |
| `GET /finance/fees`, `POST /finance/fees/preview` | Exposes current/effective-dated category rules and invokes the same integer-paise settlement calculator used by admin payout batches. |
| `GET/POST /finance/documents`, `POST /finance/documents/{id}/retry` | Generates seller-owned invoices, credit notes, payout advice, statements, certificates and COD statements as backend artifacts; failed artifacts remain retryable. |
| `GET /finance/documents/{id}/download` | Downloads only a READY artifact owned by the authenticated seller; source entity ownership is checked at generation time. |
| `GET /finance/payouts/{id}` | Detail lines include applied adjustments, and their net sum equals payout net exactly. Bank account is masked and maker-checker/UTR transfer states are projected. |

### S16 customer experience and support commands

| Route | Contract notes |
| --- | --- |
| `GET /customer-experience/reviews` | Reviews are seller-scoped through immutable order-item ownership. Buyer identity is masked; moderation and seller abuse-report status are projected without changing customer content. |
| `POST /customer-experience/reviews/{id}/reply`, `POST /customer-experience/reviews/{id}/report` | Replies enter admin moderation; abuse reports enter the shared admin queue with durable evidence IDs. Contact details and off-platform links are rejected. |
| `GET /customer-experience/questions`, `POST /customer-experience/questions/{id}/answers` | Questions are scoped through the seller's offers. Answers remain `PENDING` until admin moderation and carry response-SLA state. |
| `GET/POST /customer-experience/messages/*` | Transaction-only conversations expose masked buyer identity and enforce ownership and prohibited-content policy on every read/write. |
| `GET /support/help`, `GET /support/incidents` | Help search reads only `PUBLISHED` articles from the shared CMS; platform notices expose current operational state. |
| `GET /support/context-options`, `POST /support/tickets` | Ticket context is restricted to seller-owned orders, listings, payouts and returns. Attachments must be READY durable media owned by the seller. |
| `POST /support/tickets/{id}/messages`, `/reopen`, `/callback` | Public messages and attachments are shared with admin, internal notes are never projected, and resolution/reopen/escalation state follows the shared ticket record. |

### S17 analytics, growth and report commands

| Route | Contract notes |
| --- | --- |
| `GET /analytics/{overview,products,traffic,operations,finance}`, `GET /analytics/filters` | Every projection echoes the same seller-scoped period/timezone and applies warehouse, category, brand, fulfilment and SKU filters before aggregation. Definitions and freshness accompany computed metrics. |
| `GET /analytics/recommendations`, `POST /analytics/recommendations/{id}/{apply,dismiss,snooze}` | Recommendations expose provenance and estimated impact; state changes require an explicit seller command and append an immutable audit event. |
| `PATCH /ads/campaigns/{id}/targeting`, `GET /ads/campaigns/{id}/report` | Seller-owned scheduling, bid, keyword and negative-keyword changes; product and search-term performance share the published attribution definition. |
| `GET /ads/billing`, `GET /ads/invoices/{id}/download` | Billable spend reconciles to its spend ledger with an explicit variance; wallet entries and seller-owned invoices remain separate projections. |
| `PATCH /promotions/coupons/{id}`, `POST /promotions/coupons/{id}/{pause,resume,end,preview}` | Lifecycle commands are audited; preview invokes the shared checkout coupon evaluator and never creates a redemption. |
| `GET/POST/DELETE /reports/templates/*`, `GET/POST/PATCH/DELETE /reports/schedules/*` | Templates retain custom filters and format; schedules remain seller-owned. Generated export jobs are durable across reload and expose artifact expiry/retention. |

### S18 team security and integration commands

| Route | Contract notes |
| --- | --- |
| `GET/POST/PATCH/DELETE /settings/roles/*` | Seller-owned custom roles accept only catalogued permissions and cannot grant credential/role administration. In-use roles cannot be deleted and role changes immediately update assigned users. |
| `PATCH /settings/users/{id}`, `POST /settings/users/{id}/{resend-invite,cancel-invite,transfer-ownership}` | Role/access changes and ownership transfer require step-up where sensitive. Self-revocation, direct owner assignment and cross-seller targets are rejected. |
| `POST /settings/security/reauth`, `GET /settings/security`, `POST /settings/security/{backup-codes,2fa/replace,sign-out-all}` | Password re-authentication returns a one-use, five-minute token retained only in memory. Recovery material is create-once and security events are durable. |
| `DELETE /settings/security/sessions/{id}`, `GET /settings/audit` | Session revocation enforces ownership and preserves the current session; audit results include only actors/entities belonging to the seller organisation. |
| `GET/PATCH /settings/notification-policy` | Event-by-channel matrix, quiet hours and escalation contacts. In-panel and email security alerts are mandatory server-side. |
| `GET/POST /settings/api-keys`, `POST /settings/api-keys/{id}/{rotate,revoke}` | Scoped API credentials require step-up. Plaintext is returned once on create/rotate and never stored or returned by list endpoints. |
| `GET/POST /settings/webhooks`, `POST /settings/webhooks/{id}/rotate-secret`, `POST /settings/webhook-deliveries/{id}/retry` | HTTPS-only endpoints, allowlisted events, create-once signing secret, seller-owned delivery log, payload inspection and idempotent retry. |

## Standard page-state contract

Every new page maps query/mutation state to one of: `INITIAL_LOADING`, `REFRESHING`, `EMPTY`, `PARTIAL_FAILURE`, `FAILURE`, `FORBIDDEN`, `STALE`, `CONFLICT`, or `READY`. `PageState` and `DataTable` provide the shared rendering. A conflict must discard neither the server copy nor unsaved form state; the page offers an explicit refresh/merge action.

## Frozen permission namespaces for S10-S18

The complete executable catalog lives in `src/seller/rbac/permissions.js`. S9 freezes these roots: `onboarding`, `catalog`, `logistics`, `returns`, `customer_experience`, `analytics`, `security`, plus the cross-cutting `media` and `exports` roots. Later routes must use a catalog key and must not invent string permissions inside a component.

## Deferred production details

The mock preview URL is an opaque same-origin capability. Production returns a short-lived signed CDN URL. Object storage, malware scanning, resumable multipart transfer, worker queues, artifact generation and retention enforcement are backend/provider work; their UI-visible states and contracts are implemented here.
