# Industrial seller panel UI completion plan

**Created:** 2026-11-04  
**Scope:** remaining seller-panel UI required to reach an industrial, multi-vendor
marketplace standard, aligned with the existing customer application and admin UI.  
**Starting point:** seller phases S1-S8 are a working functional MVP with concrete
routes, shared mock-domain behavior, 2FA, and 79 passing seller tests.

## 1. Outcome and planning rule

The target is not superficial feature parity with another marketplace. The target
is a complete three-sided workflow:

`customer action -> marketplace/admin control -> seller action -> customer-visible result`

No seller screen is considered complete merely because it renders. Each phase must
finish its list/detail/action states, permissions, loading/empty/error behavior,
mobile layout, shared mock contract, cross-panel state transition, and automated
acceptance journey.

This plan covers UI and executable mock contracts. It does not implement the
production backend, provider integrations, storage, queues, or email delivery.

## 2. Cross-panel source-of-truth map

| Business journey | Customer surface | Admin surface | Seller responsibility |
|---|---|---|---|
| Become a seller | Seller lead/registration entry | Seller applications and document decisions | Complete KYC, submit documents, correct rejections, accept terms |
| Discover/buy product | Search, product detail, cart, offers | Products, categories, attributes, brands, QC, buy-box | Match catalogue or create content, maintain offer, stock, media and compliance |
| Fulfil order | Order detail, cancellation, tracking | Orders, exceptions, shipments, pickups, NDR/RTO | Accept, pack, print documents, hand over, resolve shipment exceptions |
| Return/replace | Eligibility, evidence upload, return tracking | Returns, refunds, logistics and disputes | Decide where permitted, inspect evidence, receive/QC, dispute and track reimbursement |
| Product reputation | Reviews and Q&A | Moderation, abuse reports | Answer questions, reply to reviews and report abuse |
| Seller support | Help centre, tickets, attachments | Ticket queues, SLA, escalation, chat | Search help, open contextual tickets, attach evidence, track SLA/escalation |
| Money | Customer payment/refund | Settlements, payouts, tax, invoices, reconciliation | Understand fees, download documents, trace payouts and raise disputes |
| Growth | Offers, coupons, flash sales, sponsored placements | Marketing, ads review/billing/reporting | Configure offers and ads, nominate inventory, measure conversion and ROAS |
| Notifications | Notification centre and preferences | Templates and delivery logs | Granular business-event preferences and escalation contacts |

## 3. Delivery sequence

| Phase | Name | Priority | Relative effort | Release gate |
|---|---|---:|---:|---|
| S9 | Contract and shared UX foundation | P0 | M | Required before new feature contracts |
| S10 | Seller onboarding, KYC and business identity | P0 | L | Required before seller pilot |
| S11 | Industrial catalogue and listing operations | P0 | XL | Required before catalogue backend freeze |
| S12 | Dispatch, documents and logistics operations | P0 | XL | Required before live order fulfilment |
| S13 | Warehouses, stock and inbound operations | P1 | L | Required before multi-location/FBA scale |
| S14 | Returns, replacements, claims and disputes | P0 | L | Required before live returns |
| S15 | Finance, tax and reconciliation | P0 | XL | Required before real seller payouts |
| S16 | Reviews, Q&A, buyer communication and support | P1 | L | Required before broad seller rollout |
| S17 | Analytics, recommendations and growth depth | P1 | XL | Required for commercial maturity |
| S18 | Team security, integrations and production UX | P0/P1 | XL | Final industrial-readiness gate |

`M/L/XL` is relative complexity, not a calendar estimate. Phases may overlap only
after their shared contracts and state ownership are frozen.

---

## Phase S9 - Contract and shared UX foundation

### Objective

Create the UI primitives and state conventions every remaining phase depends on.
This prevents each module inventing a different upload, document, job, confirmation,
or error experience.

### Deliverables

1. Add a seller contract inventory alongside the existing customer OpenAPI:
   - route, method, permission, request, response, error codes and idempotency flag;
   - audience base remains `/api/seller/v1`;
   - identify the shared application operation used by the admin/customer adapter.
2. Replace browser-only image handling with a reusable media workflow component:
   - file type/size/dimension validation;
   - upload progress, cancel, retry and failed-processing states;
   - server media ID plus preview URL, not a local object URL as persisted value;
   - image reorder, cover selection, crop and accessible removal controls.
3. Create shared seller components:
   - `DocumentUpload`, `DocumentViewer`, `AttachmentList`;
   - `ExportJobButton` and export-job status drawer;
   - `ActionReasonModal` with reason code, notes and attachments;
   - `AsyncActionButton` protected against duplicate submission;
   - `AuditTimeline`, `SlaCountdown`, `EntityPicker` and `DateRangeCompare`;
   - destructive-action confirmation with explicit affected-resource summary.
4. Extend table behavior for operational scale:
   - saved views, column visibility/order, density and persisted filters;
   - server-side selection and “all filtered rows” bulk actions;
   - selected/filtered export through jobs rather than browser-generated files;
   - accessible mobile-card equivalent for every critical field/action.
5. Define standard page states: initial loading, background refresh, empty, partial
   failure, full failure, permission denied, stale data and optimistic conflict.
6. Define new permission namespaces required by S10-S18 before adding navigation.

### Cross-panel contract rules

- Reuse customer media resource shape for seller documents/product media.
- Reuse admin export-job and audit-event shapes where possible.
- Shared resources use the same opaque IDs, ISO UTC timestamps and integer paise.
- UI permission checks mirror server policy names but never replace authorization.

### Acceptance gate

- Storybook or component-test states exist for every shared primitive.
- Upload can recover from network failure without losing form state.
- A page can launch an export, leave, return and observe the job result.
- Keyboard-only and screen-reader smoke coverage exists for modal, upload and table.
- No new phase persists `blob:` or base64 URLs as business data.

---

## Phase S10 - Seller onboarding, KYC and business identity

### End-to-end flow

`customer seller lead -> seller registration/2FA -> KYC submission -> admin document review -> correction request or approval -> active seller`

### Existing anchors

- Customer: seller lead/registration screens.
- Admin: Onboarding Applications, seller detail, document decisions and lifecycle.
- Seller: registration, 2FA and six-step onboarding wizard.

### Seller routes and screens

- Enhance `/onboarding` into resumable sections:
  - business type, legal identity and registered address;
  - GSTIN/PAN and category-specific registrations;
  - authorized signatory and contact verification;
  - bank account with cancelled-cheque upload;
  - pickup/warehouse address and pincode serviceability check;
  - agreement viewer with version, effective date and acceptance receipt;
  - review and submit.
- Add `/onboarding/status`:
  - per-section state: draft, submitted, under review, clarification required,
    rejected or approved;
  - admin reason, SLA and exact corrective action;
  - replace document/resubmit only the affected section;
  - application event timeline.
- Enhance `/settings/profile`:
  - document preview/download and version history;
  - renewal/expiry warnings;
  - regulated change-request flow instead of silently editing verified identity;
  - public store name/logo separately from legal identity.

### Required mock/API resources

- `sellerApplication`, `sellerApplicationSections`, `sellerDocuments`,
  `sellerAgreementAcceptances`, `sellerChangeRequests`.
- Presign/complete/abort media workflow from S9.
- Admin document decision immediately updates the seller status projection.
- Approval updates the same seller record used by admin and seller guards.

### Acceptance journeys

1. Seller uploads all required documents, submits and becomes read-only while under review.
2. Admin rejects one document; seller sees the exact reason, replaces it and resubmits only that section.
3. Admin approves all sections; seller enters the active panel without a manual mock-state change.
4. Expired document surfaces on dashboard and profile with a renewal action.
5. A verified legal-name change creates an admin-reviewed change request.

### Exit criteria

- No fake upload or plain-text-only KYC artifact remains.
- Agreement text is navigable and acceptance is versioned.
- Every admin application decision has a defined seller-visible state.

---

## Phase S11 - Industrial catalogue and listing operations

### End-to-end flow

`seller searches catalogue -> matches existing product or proposes new product -> admin QC -> offer enters buy-box -> customer product/search reflects approved content, price and availability`

### Existing anchors

- Customer: category/search/product detail, offers, cart and media.
- Admin: products, QC queue, categories, attributes, brands, HSN, size charts,
  buy-box rules and bulk-import jobs.
- Seller: listings, add product, variants, bulk CSV, brand requests and QC feedback.

### Seller routes and screens

1. Replace the single add-product entry with `/listings/new` choice:
   - search by title, brand, GTIN/EAN/ISBN or product ID;
   - “sell this product” creates an offer against canonical product content;
   - “create a new product” opens the existing category-driven content form.
2. Add `/catalog/search` and `/catalog/products/:id` seller-safe catalogue views.
3. Expand listing editor:
   - variant-level SKU, barcode, price, tax, package dimensions, stock and media;
   - category compliance documents and required-field completeness;
   - image crop/quality feedback, video and variant media;
   - listing-quality score with actionable recommendations;
   - preview matching the customer product detail presentation.
4. Expand listing lifecycle:
   - activate/deactivate, archive/relist and reasoned deletion where legal;
   - scheduled price window and compare-at/MRP validation;
   - QC version history and field-level before/after diff;
   - product-content change vs seller-offer change separation.
5. Replace one-purpose bulk create with `/listings/bulk-jobs`:
   - create products, attach offers, update price, update stock and update content;
   - category-specific templates;
   - preflight validation, row-level preview and warnings;
   - asynchronous job progress, downloadable error file and retry failed rows.
6. Add price/fee preview:
   - admin commission and shipping rules calculate expected fees and net margin;
   - warning for loss-making or buy-box-uncompetitive offers.

### Required shared behavior

- Admin QC decision updates seller version/status and customer visibility.
- Buy-box simulation and displayed winner use the admin rule engine.
- Customer product content is canonical; seller offer fields cannot overwrite it.
- Stock/price updates invalidate the same customer product and cart projections.

### Acceptance journeys

1. Seller finds an existing customer-visible product and creates only an offer.
2. Seller creates a new multi-variant product; admin requests changes on two fields;
   seller corrects them and approval makes it visible to the customer.
3. Bulk price update shows preflight errors, commits valid rows and retries failures.
4. Deactivating an offer removes it from customer availability without deleting
   canonical product content.
5. Product preview and live customer product show the same title, media and variants.

### Exit criteria

- Existing-product matching and new-product creation are distinct.
- All media are durable resource IDs.
- Every bulk operation has job history and recoverable row-level results.

---

## Phase S12 - Dispatch, documents and logistics operations

### End-to-end flow

`customer order -> seller fulfilment -> invoice/pack -> courier label/manifest -> pickup/handover -> customer tracking -> NDR/RTO or delivery`

### Existing anchors

- Customer: order detail, cancellation and shipment tracking.
- Admin: orders, exceptions, shipments, pickups/manifests, NDR, RTO, couriers,
  pincodes, shipping rules and weight disputes.
- Seller: order queue/detail and state transitions through dispatch.

### Seller routes and screens

- Add `/orders/processing` operational work queues:
  - new/acceptance SLA, pick list, pack queue, ready-to-handover and overdue;
  - saved views by warehouse/pickup address and fulfilment mode.
- Enhance order detail:
  - package creation, split shipment and partial fulfilment;
  - actual weight/dimensions and package contents;
  - courier/service and pickup slot where policy permits;
  - document centre: tax invoice, packing slip, shipping label and manifest;
  - barcode scan-to-pack and scan-to-handover;
  - immutable action/audit timeline.
- Add `/logistics/pickups`, `/logistics/shipments`, `/logistics/ndr`,
  `/logistics/rto` and `/logistics/weight-disputes` seller-scoped views.
- Add batch actions:
  - generate/print selected labels, invoices and manifests;
  - schedule/reschedule pickup;
  - bulk handover confirmation with partial-failure result.
- Surface order/shipment exceptions with permitted seller resolution actions.

### Required shared behavior

- Seller sees only their fulfilment, not unrelated order items or excessive customer PII.
- Seller shipment updates drive the customer timeline projection.
- Admin logistics actions and courier webhooks appear in seller tracking.
- NDR actions respect admin-configured response windows and reason masters.
- Generated documents are versioned artifacts, not client-composed final invoices.

### Acceptance journeys

1. Multi-seller customer order produces an isolated seller fulfilment.
2. Seller scans items, records package data, downloads documents and hands over.
3. Customer tracking reflects seller/admin/courier events in correct order.
4. NDR asks for seller input; seller responds before SLA and admin sees the decision.
5. Charged weight creates a seller dispute with documents and admin resolution.

### Exit criteria

- Labels/invoices/manifests are real downloadable UI artifacts with error/retry states.
- High-volume work does not require opening every order individually.
- Illegal state transitions are impossible from list, detail and bulk actions.

---

## Phase S13 - Warehouses, stock and inbound operations

**Implementation status: complete (2026-11-04).** The seller and admin mock domains now share versioned self-ship/FBA inventory, warehouse dependency enforcement, receiving-ledger reconciliation, discrepancy disputes, bulk retry semantics and removal tracking. The dedicated warehouse and ledger routes are production screens and the five journeys below are automated integration tests.

### End-to-end flow

`seller warehouse/stock -> customer availability reservation -> FBA inbound/admin receiving -> inventory ledger -> removal or replenishment`

### Existing anchors

- Customer: product availability and checkout inventory checks.
- Admin: warehouses, inbound, inventory ledger, adjustments and removals.
- Seller: FBA inventory, inbound creation/detail and removal request.

### Seller routes and screens

- Split settings into `/settings/warehouses` and `/settings/bank`:
  - add/edit/delete, set primary, operating hours, holiday calendar;
  - pickup capability and pincode serviceability;
  - deactivate only after dependency checks.
- Add `/inventory/ledger/:inventoryId` with reservations, releases, receipts,
  adjustments, returns, damage and removal movements.
- Add self-ship inventory by warehouse and bulk stock update.
- Enhance FBA inbound:
  - carton/pallet composition, appointment/slot, carton labels and shipment plan;
  - expected vs received line comparison;
  - shortage, damage and unexpected-SKU dispute creation;
  - documents and event timeline.
- Add ageing, blocked/damaged/quarantined inventory and removal-order tracking.
- Add replenishment recommendations using sales velocity and days of cover.

### Acceptance journeys

1. Seller stock change updates customer availability without overselling reserved stock.
2. Admin receives an inbound with discrepancy; seller sees ledger movement and can dispute.
3. Warehouse cannot be removed while it owns active stock/orders.
4. Bulk stock update reports conflicts and retries only failed SKUs.
5. Removal order moves through requested, approved, dispatched and delivered states.

### Exit criteria

- Every displayed stock number has a drill-down ledger.
- Self-ship and FBA stock are clearly separated.
- Warehouse lifecycle and address lifecycle are complete, not add-only.

---

## Phase S14 - Returns, replacements, claims and disputes

**Implementation status: complete (2026-11-04).** Returns now project moderated evidence and a shared durable timeline; seller decisions and failed QC retain structured reasons and media; admin overrides are visible to the seller; replacements create linked order-item and shipment records; return disputes create independently reviewed seller claims; and approved claims generate identified payout adjustments.

### End-to-end flow

`customer checks eligibility/uploads evidence -> seller/admin decision -> reverse pickup -> receive/QC -> refund or replacement -> seller reimbursement/dispute`

### Existing anchors

- Customer: return eligibility, request, evidence and status.
- Admin: returns, refunds, return actions and logistics.
- Seller: return list/detail, approve/reject, receive/QC and generic claims.

### Seller routes and screens

- Enhance return detail with:
  - full customer evidence viewer using shared media resources;
  - policy eligibility explanation and decision deadline;
  - seller evidence upload and structured reason codes;
  - reverse shipment tracking and return package details;
  - replacement fulfilment link and lifecycle;
  - refund/replacement result without exposing payment credentials.
- Add `/returns/:id/dispute` and link approved claims/reimbursements back to finance.
- Replace generic claim evidence textarea with attachments, linked entities and timeline.
- Add return analytics by SKU, reason, fault attribution and financial impact.

### Acceptance journeys

1. Customer evidence is visible consistently to seller and admin after moderation rules.
2. Seller rejects with evidence; admin can override and seller receives the rationale.
3. Replacement generates a new fulfilment visible to customer, seller and admin.
4. QC failure requires structured notes/media and does not silently trigger refund.
5. Approved seller claim appears as an identified payout adjustment.

### Exit criteria

- Return, replacement, refund and seller claim remain separate linked state machines.
- All decisions have reason, actor, timestamp and evidence.
- Customer and seller timelines project the same durable events.

---

## Phase S15 - Finance, tax and reconciliation

**Implementation status (2026-11-04): Complete.** Seller reconciliation, fee schedules/calculator, backend finance artifacts, failed-transfer and hold remediation, deduction disputes, admin resolution and later-payout adjustments are implemented and covered by the five S15 integration journeys.

### End-to-end flow

`delivered/cancelled/returned order -> settlement calculation -> admin payout batch -> bank transfer -> seller statement/reconciliation -> dispute or adjustment`

### Existing anchors

- Admin: settlement lines, payout batches, adjustments, commission, tax, invoices,
  COD remittance and reconciliation.
- Seller: payments summary, settlements, transactions, payout detail and tax summary.

### Seller routes and screens

- Add document actions to invoices, credit notes, payout advice, settlement statements,
  GST/TCS/TDS certificates and COD remittance statements.
- Add `/payments/reconciliation`:
  - order/return/adjustment to payout trace;
  - bank UTR/reference and transfer timeline;
  - unmatched, on-hold, failed and adjusted items;
  - dispute a line with reason and evidence.
- Add `/payments/fees`:
  - current category commission and fee schedule;
  - fee calculator matching admin preview rules;
  - effective-date history.
- Add period filters, comparisons and server-side export jobs to every finance page.
- Show payout holds with reason, required action and resolution timeline.
- Link return claims, weight disputes and admin adjustments to affected payout lines.

### Required controls

- All money remains integer paise and UI totals reconcile exactly.
- Statements come from backend artifacts; browser calculations are explanatory only.
- Mask bank details and prevent sensitive values from appearing in export/audit payloads.
- Maker-checker/admin approval status is visible without exposing internal permissions.

### Acceptance journeys

1. Every payout amount drills down to settlement lines whose net sum exactly matches.
2. Seller downloads an invoice/statement and sees generation failure/retry states.
3. Failed bank payout shows UTR status and the precise bank-detail correction action.
4. Seller disputes one deduction; admin resolves it and the adjustment appears in a later payout.
5. Return/refund and weight-adjustment financial effects are traceable from both entities.

### Exit criteria

- No finance record is a dead-end table row.
- Document downloads, reconciliation and disputes are complete UI workflows.
- Seller and admin totals share tested calculation fixtures.

---

## Phase S16 - Reviews, Q&A, buyer communication and support

**Implementation status (2026-11-05): Complete.** Seller review replies and abuse reports, moderated product answers, policy-controlled buyer messaging, CMS-backed help search, contextual durable support attachments, SLA/escalation state, callbacks, reopen handling and entity-deep-linked notifications are implemented and covered by the five S16 integration journeys.

### End-to-end flow

`customer review/question/message/support request -> moderation/routing -> seller response where allowed -> customer-visible resolution`

### Existing anchors

- Customer: reviews, questions/answers, help centre and support tickets.
- Admin: review/Q&A moderation, abuse, ticket queues, SLA, macros and chat.
- Seller: support ticket list/detail only.

### Seller routes and screens

- Add navigation group **Customer Experience**:
  - `/customer-experience/reviews` with rating, product/SKU, verified purchase,
    moderation status, reply and abuse-report action;
  - `/customer-experience/questions` with answer composer and response SLA;
  - `/customer-experience/messages` only if product policy permits direct messaging,
    with masked customer identity and prohibited-content controls.
- Enhance support:
  - searchable help centre from admin-published content;
  - contextual ticket creation using order/listing/payout/return pickers;
  - file attachments, suggested articles, SLA countdown and escalation status;
  - reopen and callback/chat entry where allowed;
  - support incident/status notices.
- Add notification links that deep-link to the exact review/question/ticket entity.

### Shared behavior

- Admin moderation determines public visibility of reviews/questions/answers.
- Seller reply does not overwrite or privately alter customer content.
- Abuse report uses the same admin abuse queue.
- Support ticket thread and attachments are shared with admin; internal notes remain hidden.

### Acceptance journeys

1. Customer asks a question; seller answers; admin moderation publishes it to customer.
2. Seller reports abusive review; admin decision updates seller-visible report status.
3. Seller raises an order-linked ticket with attachment; admin replies and seller reopens.
4. Seller cannot see admin internal notes or another seller's customer conversation.
5. Help search resolves to the same published articles visible in customer/admin CMS.

### Exit criteria

- Reviews and Q&A close the existing customer/admin loop.
- Attachments are durable media resources.
- Privacy and moderation boundaries are tested.

---

## Phase S17 - Analytics, recommendations and growth depth

**Implementation status (2026-11-05): Complete.** Five shared-filter analytics workspaces, audited recommendations, ad targeting/performance/billing depth, coupon lifecycle preview, durable export jobs, saved report templates, schedules and retention guidance are implemented and covered by the five S17 integration journeys.

### Objective

Move from summary cards and fixed CSV downloads to an actionable seller business
intelligence surface driven by customer funnel and operational events.

### Seller routes and screens

- Add `/analytics/overview`, `/analytics/products`, `/analytics/traffic`,
  `/analytics/operations` and `/analytics/finance`.
- Common controls: timezone, date range, previous-period comparison, warehouse,
  category, brand, fulfilment type and SKU filters.
- Metrics:
  - impressions -> product views -> add to cart -> checkout -> order funnel;
  - GMV, units, ASP, discounts, cancellations, returns and net earnings;
  - product/SKU profitability, buy-box share and lost-sales estimate;
  - geography/category/channel breakdown;
  - dispatch SLA, NDR/RTO, return reasons and inventory ageing;
  - ad-attributed sales, spend, CPC, CTR, conversion and ROAS.
- Recommendations inbox:
  - restock, improve content, change price, join promotion, fix SLA or answer question;
  - dismiss/snooze/apply with provenance and measurable outcome.
- Expand ads/promotions:
  - date scheduling, targeting, keyword management and negative keywords;
  - product-level performance and search-term reports;
  - budget alerts, billing ledger and downloadable invoices;
  - coupon lifecycle edit/pause/end and eligibility preview.
- Upgrade report library:
  - server-generated jobs, custom filters, saved templates, schedules and retention;
  - export centre shared with admin job conventions.

### Cross-panel alignment

- Funnel events originate from customer search/product/cart/checkout behavior.
- Admin analytics and seller analytics use the same underlying facts with different scope.
- Ad metrics reconcile with advertiser wallet and admin billing.
- Recommendations never mutate seller data without an explicit seller command.

### Acceptance journeys

1. Seller changes date range and every chart/table uses one consistent period.
2. Product funnel drill-down links directly to listing remediation.
3. Ad spend and billing ledger reconcile; attributed revenue definition is visible.
4. Report job completes asynchronously and is available after reload.
5. Applying/dismissing recommendation is audited and reflected in its state.

### Exit criteria

- Dashboard is actionable, not only descriptive.
- Metric definitions and freshness timestamps are visible.
- Heavy chart/export libraries are route-loaded, not placed in the global bundle.

---

## Phase S18 - Team security, integrations and production UX

**Implementation status (2026-11-05): Complete.** Custom least-privilege roles, user lifecycle and ownership transfer, seller audit, step-up protected security recovery and sessions, event/channel notification policy, create-once API credentials, signed webhook delivery/retry, offline recovery, accessible chart tables and spreadsheet export hardening are implemented. The S18 security/resilience journeys and route/quality checks are automated; cross-browser visual baselines remain a deployment-pipeline concern.

### Part A: team and role management

- Add custom seller roles with permission matrix and safe role templates.
- Edit a user's role, suspend/reactivate, resend/cancel invite and transfer ownership.
- Add seller-scoped user activity/audit log.
- Protect last-owner, self-revocation and privilege-escalation edge cases.

### Part B: security centre

- Add `/settings/security`:
  - 2FA status, replace authenticator and regenerate backup codes with re-authentication;
  - active sessions/trusted devices, revoke session and sign out all;
  - recent login/security events;
  - password changed and recovery-method status.
- Add step-up authentication UI for bank, role, API-key and payout-sensitive changes.

### Part C: notification and contact policy

- Replace two global switches with event-by-channel matrix:
  orders, fulfilment SLA, returns, listings/QC, inventory, payouts, account health,
  ads and security.
- Channels: in-panel, email, SMS/WhatsApp/push only where product supports them.
- Add quiet hours, escalation contacts and a mandatory non-disableable security channel.

### Part D: seller integrations

- Add `/settings/integrations`, `/settings/api-keys` and `/settings/webhooks` if
  ERP/WMS integrations are in product scope.
- API-key create-once display, scoped permissions, rotation and revoke.
- Webhook endpoint, event subscriptions, signing-secret rotation, delivery log,
  payload inspection and retry.
- Never show stored secrets after creation.

### Part E: final product-quality gate

1. Accessibility:
   - WCAG 2.2 AA audit of auth, table, form, modal, chart and upload paths;
   - keyboard navigation, focus restoration, labels, live-region errors and contrast;
   - chart data table/text equivalent.
2. Responsive UX:
   - validated widths for phone, tablet, laptop and wide operations displays;
   - sticky bulk action bar and safe mobile alternatives.
3. Performance:
   - split charts/XLSX/media editors from global bundle;
   - route budgets, virtualized large lists and cancellation of stale queries;
   - no browser-side generation for large exports.
4. Resilience:
   - retry, stale data, conflict/409, session expiry and offline/reconnect behavior;
   - prevent duplicate commands and retain unsaved long-form work.
5. Browser E2E:
   - Chromium plus one WebKit/Firefox lane for critical journeys;
   - visual regression for shell, tables, forms, dark mode and responsive layouts.
6. Security UX:
   - CSP-compatible rendering, no sensitive values in URLs/local persistence;
   - safe external links and spreadsheet formula-injection protection in exports.

### Final industrial acceptance journeys

The panel is declared UI-complete only when automated journeys prove:

1. Registration -> 2FA -> KYC correction -> admin approval.
2. Existing-product offer and new-product QC -> customer visibility.
3. Order -> scan/pack -> documents -> pickup -> customer tracking -> delivery.
4. Customer return -> evidence -> QC/refund/replacement -> seller financial effect.
5. Settlement -> payout -> statement -> bank failure correction or dispute.
6. Customer question/review -> seller response -> admin moderation -> customer visibility.
7. Sub-user custom role cannot access or mutate prohibited resources.
8. Upload/export interrupted by network failure can resume or retry safely.
9. All critical flows pass keyboard and mobile viewport checks.

---

## 4. Definition of done for every phase

Every phase must satisfy all applicable items:

- Concrete routes and navigation guarded by explicit permissions.
- List, detail and command UI; no state-changing action represented only by text.
- Loading, empty, partial-error, full-error, retry and permission-denied states.
- Responsive mobile card and desktop table behavior.
- Mock handlers enforce seller ownership and legal state transitions.
- Admin action produces seller-visible result; seller action produces customer/admin
  result where the business journey requires it.
- API adapter and query keys are centralized; no direct API call hidden in display code.
- Money, time, IDs and envelopes follow repository contract conventions.
- Audit actor/reason/evidence is retained for sensitive actions.
- Unit/component tests plus at least one cross-panel integration test.
- Critical phase journey added to browser E2E suite.
- Lint, production build, seller suite and affected admin/customer suites pass.
- Documentation records routes, permissions, API resources and deferred scope.

## 5. Recommended implementation order inside each phase

1. Freeze the shared state machine and cross-panel ownership.
2. Write the mock/API contract and failing integration journey.
3. Add permissions and route skeletons with real page-state handling.
4. Implement detail/action flow before optimizing the list screen.
5. Connect the admin/customer projection in the shared mock DB.
6. Add bulk/high-volume experience.
7. Complete accessibility, responsive behavior and browser E2E.
8. Update the seller backend contract inventory before starting the next phase.

## 6. Scope controls

- Do not duplicate admin-only controls in seller UI. Seller sees scoped status and
  permitted responses, not internal moderation, maker-checker or agent tools.
- Do not expose cross-seller data or full customer PII.
- Do not make Socket.IO/realtime a source of truth; reconnect refetches durable state.
- Do not generate authoritative invoices, labels, settlements or tax artifacts in the browser.
- Do not create separate seller business rules; customer/admin/seller adapters call
  the same application use-cases.
- Defer API keys/webhooks if third-party seller integration is explicitly outside
  the first commercial release, but keep the security/settings design extensible.

## 7. Backend-start boundary

Backend work may continue immediately on existing identity and listing-QC vertical
slices. Before implementing the later production endpoints, freeze the corresponding
phase contract in this order:

`S9 -> S10/S11 -> S12/S14 -> S15 -> S13 -> S16 -> S17 -> S18`

This avoids implementing shallow endpoints that must be redesigned once document,
bulk-job, evidence, reconciliation, moderation and security states are introduced.
