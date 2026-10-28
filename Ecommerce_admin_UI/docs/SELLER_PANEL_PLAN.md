# Arise Seller Panel — Master Plan (+ Admin/Seller module split)

> Companion to `ADMIN_PANEL_PLAN.md` and `MODULE_SPECS.md`.
> Goal: inside the existing `Ecommerce_admin_UI` project, (1) migrate the admin
> panel into a self-contained `src/admin/` module, and (2) build a complete,
> Flipkart/Amazon-Seller-Central-class **seller panel** as a second module in
> `src/seller/`, both sitting on one shared foundation and one shared mock backend.

---

## Implementation status

- **Phase 0 — module split:** ✅ done. `src/shared/{core,ui,theme,mocks}` + `src/admin/*`
  + `src/seller/*`; aliases `@core @ui @theme @mocks @admin @seller`.
- **Phase S1 — seller foundation & shell:** ✅ done (2026-10-24). Admin stays at site
  root `/`; the seller app is a second SPA under `/seller` (router `basename: '/seller'`
  + a `sellerSpaFallback` Vite middleware for dev/preview deep links). Delivered:
  seller session/API base (`setApiBaseUrl('/api/seller/v1')`, reusing `@core/auth`),
  seller RBAC catalog + role templates, seller nav model, `SellerLayout`/`SellerAuthLayout`
  shell, auth pages (login, register, forgot/reset, accept-invite, change-password),
  the 6-step onboarding wizard, a dashboard, account page, and the seller mock backend
  (auth/me/onboarding/dashboard handlers + account seed) on the **shared DB**. Demo
  logins: `owner@arise.test`, `catalog@arise.test`, `orders@arise.test`,
  `newseller@arise.test` (mid-onboarding) — all `Arise@123456`. Verified: lint clean,
  both entries build, seller tests 10/10, admin suite unaffected (isolated 63/63),
  dev routing smoke-tested.
  - Scoped deviations from the plan (to keep S1 tight): seller **2FA** deferred to a
    later hardening pass (login is single-step); the RBAC **engine/data split** was
    deferred (admin catalog still lives in `@core/rbac`) since seller RBAC is
    self-contained in `@seller/rbac`; the mock backend is **one worker per app page**
    sharing the DB via the snapshot (reload-synced) rather than a single merged worker.
- **Phase S2 — listings / catalog:** ✅ done (2026-10-24). Seller catalog on the
  **shared DB**: My Listings (DataTable of the seller's offers, status/buy-box/price/
  stock, tabs + filters), Add Product (category-driven form → QC-pending listing),
  Listing detail (QC auto-checks, NEEDS_CHANGES reasons, price/stock quick-edit,
  content edit, resubmit), Bulk Upload (CSV via papaparse → preview → submit), and
  Brand/Category Requests. Seller API `/api/seller/v1/listings*`, `/catalog/*`,
  `/brand-requests`; writes `products`/`variants`/`offers`/`listingSubmissions`/
  `brandRequests`, reusing the shared `buyBox` engine. **Golden loop proven** by an
  MSW integration test: a seller-created listing lands in the admin Listing QC Queue
  (`QC_PENDING` submission), and an admin decision flows back to the listing status.
  Verified: lint clean, both entries build, seller tests 17/17 (incl. HTTP-layer
  golden-loop + seller-scoping). Seller `CURRENT_PHASE` now 2.
- **Phase S3 — orders & fulfilment:** ✅ done (2026-10-24). Seller works a "shipment"
  (its slice of a customer order) through the shared item state machine:
  PLACED →(confirm)→ ACCEPTED →(invoice & pack)→ PACKED →(label & manifest)→ MANIFESTED
  →(dispatch)→ SHIPPED. Screens: Orders list (tabs New/To-ship/Shipped/Delivered/
  Cancelled, filters, per-row next-step button, bulk confirm/pack/manifest/dispatch),
  Order detail (process stepper, items, ship-to, shipment/invoice/AWB, timeline,
  cancel-with-reason), Cancellations. Self-ship vs FBA (ARISE shipments are read-only —
  "Fulfilled by Arise"). Seller API `/api/seller/v1/orders*`; writes shared
  `orderItems`/`shipments`/`orderEvents` (+ `refunds` on prepaid cancel) that the admin
  Orders & Logistics screens read — proven by an MSW integration test
  (confirm→dispatch writes SELLER `orderEvents`, illegal-transition guard, prepaid-cancel
  refund, seller-scoping). Verified: lint clean, both entries build, seller tests 21/21.
  Seller `CURRENT_PHASE` now 3.
- **Phase S4 — returns, inventory & FBA inbound:** ✅ done (2026-10-24). Returns &
  Replacements (tabs by stage; approve → reverse pickup scheduled, reject-with-reason,
  mark received, record QC → refund on pass; FBA returns read-only), Inventory (FBA
  stock with buckets/available/days-of-cover, low-stock & aged filters, request-removal),
  FBA Inbound (list + create consignment with SKU lines → submit to a warehouse, detail
  with received GRN lines & discrepancies, cancel), and an RTO tab on Orders. Seller API
  `/returns*`, `/inventory*`, `/inbound*`, `/warehouses`; writes shared `returns`/
  `inboundConsignments`/`inboundLines`/`removalOrders`/`refunds`. **Loop proven**: a
  seller-created inbound lands as a `SUBMITTED` consignment the admin Warehouses/Inbound
  queue reads (and admin receiving then raises seller inventory). Verified: lint clean,
  both entries build, seller tests 25/25. Seller `CURRENT_PHASE` now 4.
- **Phase S5 — payments & finance:** ✅ done (2026-10-24). Payments dashboard (next
  payout / in-process / on-hold / paid, hold-reason breakdown, lifetime earnings
  waterfall), Settlements (per-batch payouts → payout detail with the calculation and
  per-order lines), Transactions (settlement-line ledger with tabs Upcoming/Settled/
  On-hold and a deduction-waterfall drawer that explains every fee), Invoices & Tax
  (GST tax invoices + credit notes, TCS/TDS summary). Seller API `/finance/*`; reads the
  shared `settlementLines`/`sellerPayouts`/`invoices`/`taxSummaries` the admin Finance
  screens compute from the shared `engine/settlement`. **Reconciliation guaranteed by
  construction** — a seller's payout is the same `sellerPayouts` row the admin batch
  holds; a test asserts every payout's gross equals the sum of its lines' sale amounts,
  and every line's net equals its deduction waterfall. Verified: lint clean, both
  entries build, seller tests 30/30. Seller `CURRENT_PHASE` now 5.
- **Phase S6 — growth, promotions & ads:** ✅ done (2026-10-24). *Advertising*:
  Campaigns list (spend/CTR/ROAS, wallet balance tag), Create campaign (pick live
  listings, automatic or manual-CPC bidding, daily/total budget, submit-for-review),
  Campaign detail (status actions submit/pause/resume/end, budget edit, a
  spend-&-clicks `recharts` line chart, promoted products, keywords), wallet recharge
  for prepaid advertisers. *Promotions*: Flash Sales (browse open sales, nominate a
  live listing with a flash price validated against the sale's minimum discount — a
  below-minimum nomination auto-rejects), My Nominations, Coupons (seller-funded
  create + list, redemption progress). Seller API `/ads/*`, `/promotions/*`; writes
  shared `adCampaigns`/`adGroups`/`advertiserWallets`/`advertiserLedger`/
  `flashSaleNominations`/`coupons`, reusing the shared `engine/ads` transition table.
  **Loop proven**: submitting a campaign lands it `PENDING_REVIEW` in the same
  `adCampaigns` collection the admin Ad Review Queue reads; a flash-sale nomination
  lands in admin curation. Verified: lint clean, both entries build, seller tests
  35/35. Seller `CURRENT_PHASE` now 6.
- **Phase S7 — performance & account health:** ✅ done (2026-10-24). Account Health
  (composite score gauge + tier, a metric breakdown — cancellation/late-dispatch/
  return/negative-review rate — each flagged good/watch/needs-action, an 8-week
  `recharts` trend line from real orders, a ratings distribution card), Penalties
  (list + dispute-with-reason, one dispute only), Claims (list + file-a-claim modal).
  Seller API `/performance/*`, `/penalties*`, `/claims*`; reads the same `sellers`
  fields, `penalties` and `sellerClaims` rows the admin Performance/Penalties/Seller
  Claims screens use, and a seller-initiated **dispute** transition
  (`APPLIED → DISPUTED`) that the admin waive/recover flow then resolves. Verified:
  lint clean, both entries build, seller tests 40/40 (incl. cross-seller penalty
  access denial). Seller `CURRENT_PHASE` now 7.
- **Phase S8 — support, reports, settings & hardening:** ✅ done (2026-10-24) —
  **all 8 phases of the seller panel are now complete.**
  - *Support*: Help & Tickets (raise, list, thread with reply, close) over the
    **shared `tickets`/`ticketEvents`** the admin Ticket Queues read — the seed's
    `channel: 'SELLER_PANEL'` and `requesterType` fields, present but unused since
    Phase 0, are the first thing this phase actually sets.
  - *Reports*: a small, real report library — four cards (Orders, Transactions,
    Inventory, Ads) that export the seller's own already-fetched data as CSV via
    the shared `xlsx` lib, client-side; no fake report-job queue.
  - *Settings*: Business Profile (store/legal name, GSTIN/PAN, KYC doc status,
    **holiday/vacation mode** toggle), Bank & Pickup (bank account with penny-drop
    status, pickup addresses with one-primary invariant), Users & Roles (invite a
    sub-user → the exact `/accept-invite` flow built in Phase S1, revoke access;
    owner cannot be removed), Notifications (per-user email/in-panel toggles).
  - *Hardening*: audited every raw `<Table>` across all seven prior phases and
    added `scroll={{ x: 'max-content' }}` for mobile (9 files); added a
    `routes.test.js` check — mirroring the admin router's own convention — that
    asserts **every nav item resolves to a real screen, with zero placeholders
    left** (32 assertions, one per nav item).
  - **Cross-module demo script**: rather than a manual walkthrough, every shared-DB
    loop from the plan is proven by an automated MSW integration test: S2 listing→
    QC, S3 order fulfilment, S4 FBA inbound, S6 ad campaign→review & flash-sale
    nomination, S7 penalty dispute, S8 ticket→admin queue and sub-user invite→accept.
  - Verified: lint clean, both entries build, seller tests **74/74**, full project
    regression 603/605 (2 failures were the same CPU-contention timeout pattern
    seen in every prior phase's full run — confirmed by isolated re-run: 37/37).
  - Seller `CURRENT_PHASE` now 8 — **the full seller panel plan is complete.**

## Post-S8 detail-parity pass (2026-10-24)

User feedback: the seller panel read as noticeably less detailed and "very
normal" next to the admin panel. Traced to concrete, fixable causes rather
than vague polish:

- **No live alerts bell** — the admin header's `AlertsBell` (polling,
  real content, mark-read) had no seller counterpart; the seller header's
  bell-shaped slot was an inert help icon. Added `src/seller/mocks/engine/
  sellerAlerts.js` (derives low-stock, SLA-breach, failed-payout, applied-
  penalty, rejected-campaign and awaiting-reply alerts live from existing
  collections — nothing stored as rows) + `GET/POST /dashboard/alerts[/:key/
  read]` + a `SellerAlertsBell` component mirroring the admin one exactly,
  wired into `SellerHeader`. The help icon now actually navigates to `/support`.
- **Dead CTAs** — the dashboard's "Grow your business" tip links had no
  `onClick` at all; fixed with real `link` targets from the handler.
- **Latent bug**: `SellerHeader` read `user?.tier`, which `publicUser()` never
  set — the tier tag had silently never rendered. Added `tier` and `rating`
  to the session user and a star rating next to it in the header.
- **Thin dashboard** — added a "Recent activity" card using the shared
  `ActivityTimeline` (the same component the admin dashboard uses), fed by a
  new `sellerActivity.js` engine that unifies order events, ticket replies,
  QC decisions and penalties into one feed.
- **Downgraded list screens** — five pages built in S4/S6/S7/S8
  (Penalties, Claims, Brand Requests, Coupons, Support tickets) used a plain
  `antd Table` instead of the shared `DataTable`, losing column chooser, bulk
  actions, density toggle, tabs-with-counts and the mobile-card fallback that
  make every admin list feel consistent. Converted all five to `DataTable`.
- Verified: lint clean, both entries build, seller tests **75/75** (added a
  unit test for the new activity feed).

## Panel-wide column-visibility bug (found 2026-10-24, fixed same day)

User screenshot showed My Listings rendering **only its Fulfilment column**.
Root cause: `DataTable`'s `priority` prop is **inverted** from the intuitive
reading — `1` = essential/always visible, `3` = first dropped on narrow
screens (desktop cutoff is `3`; `col.priority ?? 1` is the default for an
*omitted* `priority`). Every seller column array built across S2–S8 used an
"importance" scale of **10 down to 3** (treating higher = more important),
so every column above `3` was silently dropped **at every breakpoint,
including desktop** — the exact opposite of the real contract. This affected
**13 files**, every `DataTable`/inline-columns usage in the seller module;
most pages were rendering with only one (or in `CampaignsPage`/`InvoicesPage`/
etc., all-but-one) column this entire time, undetected because no test
renders column visibility — only data-layer behaviour is covered. Remapped
every column to the real 1–3 scale across all 13 files. Verified: lint clean,
both entries build, seller tests still 75/75 (confirms the bug was purely
presentational). **Lesson for S9+**: `priority` on a `DataTable`/`FilterBar`
column means 1 (essential) – 3 (droppable first), never higher, and omitting
it defaults to 1 (always visible) — check `columnPrefs.js`'s `resolveColumns`
before assuming a prop's semantics from its name.

## 0. Table of contents

- Part A — Analysis & target architecture
  - §1 What exists today
  - §2 Shared-vs-module decision
  - §3 Target folder layout
  - §4 Alias & build strategy (multi-entry)
  - §5 One shared mock backend (the two-sided simulation)
  - §6 Seller RBAC & session model
- Part B — Phase 0: the migration (do this first, zero behaviour change)
- Part C — Seller panel scope (module catalogue)
- Part D — Phased roadmap S1–S8 (super-detailed)
- Part E — Cross-cutting standards, testing, Definition of Done
- Part F — Risks, sequencing, open questions

---

# PART A — Analysis & target architecture

## 1. What exists today

**Stack:** Vite 6, React 18, Ant Design 5, `@tanstack/react-query` 5, `zustand` 5,
`react-router-dom` 6, MSW 2 mock API, `recharts`, `xlsx`/`papaparse`, `zod`,
`@dnd-kit`, `dayjs`. JS only (no TS). `faker` EN_IN for seeds.

**Layering (feature-sliced):**

```
src/
  main.jsx                 app bootstrap; starts MSW in mock mode
  app/        @app         App.jsx, router/, theme/ (tokens, antdTheme, themeStore)
  core/       @core        api/ (axios, queryClient, errors), auth/ (sessionStore,
                           authApi, idle/bootstrap), rbac/ (catalog, scopes, roles,
                           Can, useCan), config/env, utils/
  shared/     @shared      components/ (DataTable, PageHeader, FilterBar, StatCard,
                           ImportWizard, RuleBuilder, AuditDrawer…), hooks/, constants/
                           (navigation.js, statusMaps, glossary), utils/
  features/   @features    20 modules × {api, components, pages}
  layouts/    @layouts     AppLayout, AuthLayout, Sidebar, AppHeader, GlobalSearch…
  mocks/      @mocks       db/store (in-memory collections + snapshot persistence),
                           engine/ (business logic), handlers/ (50 route files,
                           base = /api/admin/v1), seed/ (faker seeds), browser.js
  styles/global.css
  test/setup.js
```

**Admin feature modules (M1–M17):** dashboard, orders, catalog, sellers, customers,
warehouse, logistics, finance, wallet, marketing, ads, cms, reviews, support,
reports, notifications, adminUsers, roles, approvals, audit, settings, me, system, dev.

**Key infrastructure the seller module will reuse as-is:**
- `@core/api/axiosInstance` — token refresh, error normalisation, `IS_MOCK` switch.
- `@core/auth/sessionStore` — zustand session state machine (loading → anonymous →
  pending_2fa → pending_password_change → authenticated); access token in memory,
  refresh token in localStorage in mock mode.
- `@core/rbac` — permission catalog, `Can`, `useCan`, role templates, data scoping.
- `@shared/components/DataTable` — URL-synced table (sort/filter/paginate, column
  chooser, bulk actions, mobile card list), `FilterBar`, `PageHeader`, `StatCard`,
  `ImportWizard`, `RuleBuilder`, `AuditDrawer`, money/date/mask formatters.
- `@app/theme` — design tokens, dark mode (`themeStore`), AntD `ConfigProvider` build.
- `@mocks/db/store` + `@mocks/engine/*` — the in-memory DB and business logic.

**Blast radius for the split (measured):**

| Alias | References | Disposition |
|---|---:|---|
| `@core/` | 341 | stays shared — **no change** |
| `@shared/` | 836 | stays shared — **no change** |
| `@mocks/` | 33 | split: `db`/`engine`/`persistence` shared, `handlers`/`seed` move under admin |
| `@app/` | 9 | → `@admin/app` |
| `@features/` | 139 | → `@admin/features` |
| `@layouts/` | 2 | → `@admin/layouts` |

Only **~150 import sites** change for the admin move; the 1177 `@core`/`@shared`
references are untouched. This is why the migration is low-risk.

## 2. Shared-vs-module decision

Rule of thumb: **anything the backend contract and design system own is shared;
anything that is "this persona's app" is module-local.**

| Concern | Shared (foundation) | Admin module | Seller module |
|---|---|---|---|
| HTTP client, query client, error model | ✅ `@core/api` | | |
| Design tokens, dark mode, AntD theme | ✅ `@shared/theme` | accent override | accent override |
| RBAC **engine** (catalog builder, `Can`, scopes) | ✅ `@core/rbac` | admin permission data | seller permission data |
| Session store **machine** | ✅ `@core/auth/sessionStore` | admin bootstrap/authApi | seller bootstrap/authApi |
| DataTable, FilterBar, formatters, hooks | ✅ `@shared/ui` | | |
| Mock **DB + engine + persistence** | ✅ `@shared/mocks` | admin handlers + seed | seller handlers + seed |
| App shell (layout, sidebar, header) | | ✅ admin chrome | ✅ seller chrome |
| Router, nav model, features/pages | | ✅ | ✅ |
| API base path | | `/api/admin/v1` | `/api/seller/v1` |

Design principle: **the two modules never import from each other.** They only
import from the shared foundation. (Enforced by an eslint `no-restricted-imports`
rule — see §4.)

## 3. Target folder layout

```
src/
  shared/                         ← FOUNDATION (cross-module; was @core + @shared + mock core)
    core/        @core            api/, auth/ (sessionStore, idle, bootstrap hook),
                                  rbac/ (engine only: catalog builder, Can, useCan,
                                  scopes, roleTemplates helper), config/, utils/
    ui/          @ui              DataTable/, PageHeader, FilterBar, StatCard, StatusTag,
                                  ImportWizard, RuleBuilder, AuditDrawer, Money/Date/Mask,
                                  EmptyState, ErrorState, hooks/, constants/ (statusMaps,
                                  glossary), utils/
    theme/       @theme           tokens.js, antdTheme.js, themeStore.js
    mocks/       @mocksCore       db/store.js, engine/*, persistence.js, browser.js
                                  (registers BOTH admin + seller handler sets)
    styles/global.css
    test/setup.js

  admin/         @admin           ← ADMIN MODULE
    main.jsx                      admin entry (was src/main.jsx)
    app/                          App.jsx, router/, SessionBootstrap, guards
    layouts/                      AppLayout, AuthLayout, Sidebar, AppHeader…
    rbac/                         permissions.data.js (admin catalog), role templates
    nav/                          navigation.js (admin sidebar model)
    features/                     the 20 admin feature modules (unchanged internals)
    mocks/                        handlers/ (base /api/admin/v1) + seed/

  seller/        @seller          ← SELLER MODULE (new)
    main.jsx                      seller entry
    app/                          App.jsx, router/, SessionBootstrap, guards
    layouts/                      SellerLayout, SellerAuthLayout, SellerSidebar, header
    rbac/                         seller permission catalog + seller role templates
    nav/                          navigation.js (seller sidebar model)
    features/                     seller feature modules (built in Part D)
    mocks/                        handlers/ (base /api/seller/v1) + seed/ (seller linkage)

admin.html                        entry → /src/admin/main.jsx
seller.html                       entry → /src/seller/main.jsx
index.html                        landing: links/redirect to /admin or /seller
```

Notes:
- The admin feature internals (`features/*/{api,components,pages}`) keep their shape;
  only their `@app`/`@features`/`@layouts` imports are rewritten to `@admin/*`.
- `rbac/permissions.data.js` and `shared/constants/navigation.js` are **module-owned**
  (each persona has a different catalog and sidebar) — they move out of shared into
  `admin/rbac` + `admin/nav` and get seller equivalents. The rbac *engine* that
  consumes them stays in `@core/rbac`.

## 4. Alias & build strategy (multi-entry, one dev server)

**Why two entries, not one SPA:** admin and seller are genuinely different apps
(different login, nav, permissions, deploy target → `admin.arise.com` /
`seller.arise.com`). Vite multi-page gives true isolation while sharing
`node_modules`, the foundation, and one mock service worker. A seller never
downloads admin code and vice-versa (separate bundles).

`vite.config.js` changes:
```js
const alias = {
  '@core':      'src/shared/core',
  '@ui':        'src/shared/ui',
  '@theme':     'src/shared/theme',
  '@mocksCore': 'src/shared/mocks',
  '@admin':     'src/admin',
  '@seller':    'src/seller',
};
build.rollupOptions.input = {
  admin:  resolve(__dirname, 'admin.html'),
  seller: resolve(__dirname, 'seller.html'),
};
```
Keep the existing `@shared` alias pointing at `src/shared/ui` as a **compat alias**
during migration so the 836 `@shared/components/*` imports don't all need rewriting
on day one (optional; can be collapsed into `@ui` later).

`jsconfig.json` `paths` updated to match (editor intellisense).

**Dev scripts:** `vite --mode mock` serves both pages
(`localhost:5173/admin.html`, `/seller.html`). Add npm aliases `dev`,
`build` that build both inputs.

**Import-boundary lint:** add to `.eslintrc.cjs`
`no-restricted-imports` zones so `src/admin/**` cannot import `@seller/*` and
`src/seller/**` cannot import `@admin/*`; both may import the foundation.

## 5. One shared mock backend (the two-sided simulation)

This is the highest-leverage design decision.

- `src/shared/mocks/db/store.js` keeps the single in-memory collection store and
  snapshot persistence (bump `SNAPSHOT_VERSION`).
- `src/shared/mocks/browser.js` registers **`[...adminHandlers, ...sellerHandlers]`**
  on one MSW worker (same origin, one service worker).
- Admin handlers stay at `/api/admin/v1`; seller handlers live at `/api/seller/v1`
  and **read/write the same collections** (`sellers`, `products`,
  `listingSubmissions`, `orders`, `returns`, `inventory`, `payoutBatches`,
  `settlementLines`, `penalties`, `sellerClaims`, `adCampaigns`, …).
- Seller endpoints are **scoped to the signed-in seller** (every query filters by
  `sellerId`, every write stamps it) — the mock engine enforces this exactly like a
  real backend would.

Payoff — demoable end-to-end loops with no backend:
1. Seller creates a listing → `listingSubmissions` row → **admin Listing QC Queue**
   shows it → admin approves → product goes live → seller sees "Active".
2. Customer order (seeded) lands → seller **confirms → invoices → labels →
   dispatches** → **admin Orders / Logistics** reflect each state transition.
3. Seller raises an SPF **claim** → **admin Seller Claims** inbox → admin decides →
   seller sees the outcome + wallet/settlement effect.
4. Admin levies a **penalty** → seller **Account Health** shows it → seller files a
   waiver claim.

Shared engine functions (order state machine, settlement, buy-box, segments) are
reused so both sides compute identical derived values.

## 6. Seller RBAC & session model

Reuse the `@core/rbac` engine with a **separate, smaller seller permission catalog**
(`src/seller/rbac/permissions.data.js`). Seller org model:

- **Account owner** (the seller who onboarded) — all seller permissions.
- **Sub-users** (staff the seller invites) with seller role templates:
  - *Catalog Manager* — listings, inventory.
  - *Order Manager* — orders, returns, shipping.
  - *Finance Viewer* — payments, reports (read-only).
  - *Ads Manager* — advertising.
  - *Admin* — everything incl. sub-user management & settings.
- Seller permission keys mirror the admin style, e.g. `listings.product.edit`,
  `orders.order.process`, `finance.payout.view`, `ads.campaign.manage`,
  `settings.user.manage`.
- **Account-status gating** is a first-class guard: an onboarding-incomplete or
  suspended seller is routed to a restricted shell (only Onboarding / Support).
  Implemented as a route guard alongside `RequirePermission`
  (`RequireActiveSeller`).

Session: reuse `sessionStore` machine; seller `authApi` hits `/api/seller/v1/auth/*`.
The signed-in seller's `sellerId`, `accountStatus`, `permissions`, and (optional)
sub-user scope live on the session user object.

---

# PART B — Phase 0: the migration (do first; zero behaviour change)

**Objective:** reorganise the repo into foundation + `admin` + `seller` skeleton
with the admin panel behaving **identically** (same routes, same screens, same tests
green). No new features. This is purely structural and must be a single reviewable
step before any seller feature work.

### P0.1 — Create the foundation layer
1. `git mv` `src/core` → `src/shared/core`; `src/app/theme` → `src/shared/theme`.
2. Move cross-cutting `src/shared/*` (components, hooks, constants, utils) →
   `src/shared/ui/*`. Keep `statusMaps`/`glossary` here; move `navigation.js` to
   admin (step P0.3).
3. Move mock **core**: `src/mocks/{db,engine,persistence.js,browser.js}` →
   `src/shared/mocks/`. Leave `handlers/` and `seed/` to move under admin.
4. Split `rbac`: engine (`catalog.js`, `Can.jsx`, `useCan.js`, `scopes.js`,
   `index.js`, `roleTemplates.js` *builder*) stays in `@core/rbac`; the admin
   **data** (`permissions.data.js`, admin role template definitions) moves to
   `src/admin/rbac/`.

### P0.2 — Create the admin module
1. `git mv` `src/app` → `src/admin/app`, `src/layouts` → `src/admin/layouts`,
   `src/features` → `src/admin/features`.
2. `git mv` `src/mocks/handlers` → `src/admin/mocks/handlers`,
   `src/mocks/seed` → `src/admin/mocks/seed`.
3. `git mv` `src/main.jsx` → `src/admin/main.jsx`.
4. Move `src/shared/constants/navigation.js` → `src/admin/nav/navigation.js`.

### P0.3 — Rewrite imports (codemod)
Automated search/replace across `src/admin/**` (run, then lint):
- `@app/` → `@admin/app/`
- `@features/` → `@admin/features/`
- `@layouts/` → `@admin/layouts/`
- `@mocks/db` / `@mocks/engine` / `@mocks/persistence` / `@mocks/browser` →
  `@mocksCore/...`; `@mocks/handlers` / `@mocks/seed` → `@admin/mocks/...`
- rbac data imports → `@admin/rbac/...`; navigation → `@admin/nav/...`
- `@core/`, `@shared/`(→`@ui/` or keep compat), `@theme/` adjusted per §4.
Then rename theme imports (`@app/theme/*` → `@theme/*`).

### P0.4 — Build wiring
1. Update `vite.config.js` aliases + `build.rollupOptions.input` (admin + seller).
2. Update `jsconfig.json` paths.
3. Create `admin.html` (→ `/src/admin/main.jsx`) and a placeholder `seller.html`
   (→ `/src/seller/main.jsx` that renders "Seller panel — coming soon").
4. `index.html` becomes a chooser/redirect.
5. `src/shared/mocks/browser.js`: import admin handlers now, seller handlers later
   (empty array placeholder).

### P0.5 — Seller skeleton
Create empty `src/seller/{app,layouts,rbac,nav,features,mocks}` with a minimal
`main.jsx` + `App.jsx` rendering a themed "coming soon" shell, so the second entry
builds.

### P0.6 — Verify (acceptance)
- `npm run lint` clean; `npm test` (vitest) green — the existing
  `routes.test.js`, `rbac.test.js`, `seedPhase1.test.js`, engine tests must pass
  **unchanged** except for import-path edits.
- `npm run dev` → `/admin.html` loads, every admin route works, dark mode + mock
  sign-in unchanged. `/seller.html` loads the placeholder.
- Add `docs/` note: "admin moved to src/admin; foundation in src/shared."

> Deliverable of Phase 0: a PR titled *"chore: split into shared/admin/seller
> modules (no behaviour change)"*. Everything after builds on this.

---

# PART C — Seller panel scope (module catalogue)

A complete Seller-Central/Seller-Hub-class panel. Each seller module maps to an
admin counterpart (shared DB endpoints to mirror) and to real Flipkart/Amazon
features.

| # | Seller module | Core screens | Admin counterpart (shared data) |
|---|---|---|---|
| SM0 | **Auth & Onboarding** | Login, register, forgot/reset, 2FA, onboarding wizard (business, GST/PAN, bank, pickup, signature agreement), status tracker | M4 Sellers (applications, KYC, brand approvals) |
| SM1 | **Dashboard / Home** | Sales snapshot, orders-to-process, payments due, account-health score, growth tips, announcements | M1 Dashboard |
| SM2 | **Listings / Catalog** | My listings, add single, bulk upload, edit, variants, images, price & stock, QC status, brand/category requests, buy-box status, suppressed/inactive | M3 Catalog + QC queue |
| SM3 | **Orders & Fulfilment** | New/all orders, process flow (confirm→invoice→label→manifest→dispatch), self-ship vs FBA, bulk actions, cancellations | M2 Orders + M7 Logistics |
| SM4 | **Returns & Inventory/FBA** | Returns & replacements, RTO tracking, inventory by warehouse, low-stock, FBA inbound creation, removals | M2 Returns, M6 Warehouses, M7 Logistics |
| SM5 | **Payments & Finance** | Payment dashboard, settlement/payout reports, transaction ledger, commission & fee breakdown, invoices, GST/TDS/TCS, reconciliation, payment holds | M8 Finance + M9 Wallet |
| SM6 | **Growth, Promotions & Ads** | Deals/flash-sale participation, seller coupons, price recommendations; sponsored-product campaigns, budgets, keywords, ad reports, ad billing | M10 Marketing, M11 Ads |
| SM7 | **Performance & Account Health** | Health score, SLA/cancellation/RTO/late-dispatch metrics, ratings & feedback, policy violations, penalties, SPF claims | M4 Sellers (performance, penalties, claims), M13 Reviews |
| SM8 | **Support, Reports & Settings** | Tickets/claims, notifications & announcements, help/learning center; report library + scheduled/exports; settings: profile, GST/PAN, bank, pickup addresses, sub-users & roles, notification prefs, shipping, vacation/holiday mode | M14 Support, M15 Reports, M16 Notifications, M17 Admin/Settings |

---

# PART D — Phased roadmap S1–S8 (super-detailed)

Each phase lists: **screens**, **reused shared components**, **seller API endpoints
(`/api/seller/v1`)**, **shared-DB interactions**, **RBAC perms**, **acceptance**.
Phases are ordered to deliver a demoable two-sided loop as early as possible.

---

## Phase S1 — Seller foundation & shell  *(builds on Phase 0)*

**Screens**
- `SellerAuthLayout`: Login, Register, Forgot/Reset password, 2FA challenge,
  Accept-invite (sub-user).
- **Onboarding wizard** (`/onboarding`): steps — Business details → GST & PAN →
  Bank account → Pickup address → Category/brand intent → Agreement & e-sign →
  Submitted/Under-review status tracker.
- `SellerLayout` shell: collapsible sidebar (seller nav model), header (store name,
  account-health pill, notifications bell, help, user menu), responsive drawer,
  idle timeout, dark mode — all reusing admin shell patterns.
- Dashboard skeleton (tiles wired in S? placeholders), `RequireActiveSeller` gate,
  NotFound/placeholder pages for unbuilt nav items (same pattern as admin router).

**Reused**: `sessionStore`, idle timeout, `@core/api`, `@theme`, `DataTable` later,
`PageHeader`, `StatCard`, `Can`/`useCan`, router guard pattern.

**Seller API**: `POST /auth/login|logout|refresh|2fa`, `POST /auth/register`,
`POST /auth/forgot|reset`, `GET /me`, `GET/POST/PATCH /onboarding`,
`POST /onboarding/submit`, `GET /onboarding/status`.

**Shared DB**: register endpoints create/read a `sellers` row + `kycDocuments`,
`bankAccounts`, `pickupAddresses`, and a `listingSubmissions`/`sellerApplications`
record so the **admin "Onboarding Applications"** screen can review it. Seed 2–3
demo seller logins (owner + a sub-user) linked to already-seeded `sellers`.

**RBAC**: seller catalog + role templates; owner auto-granted all; sub-user via
accept-invite.

**Acceptance**: seller can register → complete onboarding → appears in admin
applications; admin approval flips seller `accountStatus` to active → seller shell
unlocks. Login/2FA/idle/dark-mode all work. Tests: seller `routes.test`,
seller rbac test, onboarding reducer/engine test.

---

## Phase S2 — Listings / Catalog (SM2)

**Screens**: My Listings (DataTable: status, buy-box, price, stock, QC state),
Add Product (single, category→attribute-set driven form with `zod` validation),
Edit Product, Variant manager, Image manager, **Bulk Upload** (reuse
`ImportWizard` + `xlsx`/`papaparse` template), Price & Stock quick-edit (inline +
bulk), Brand/Category request, QC-rejection detail (reasons + resubmit),
Suppressed/Inactive listings.

**Seller API**: `GET /listings`, `POST /listings`, `PATCH /listings/:id`,
`POST /listings/bulk`, `GET /listings/:id`, `POST /listings/:id/resubmit`,
`GET /catalog/categories|attributes|brands|size-charts|hsn`,
`POST /brand-requests`, `PATCH /listings/:id/price`, `PATCH /listings/:id/stock`.

**Shared DB**: writes `products`, `variants`, `offers`, `listingSubmissions`,
`productRevisions`, `brandRequests`. **Admin Listing QC Queue** consumes
`listingSubmissions`; admin decision writes back status → seller sees it. Buy-box
status computed via shared `engine/buyBox`.

**RBAC**: `listings.product.view|create|edit|delete`, `listings.price.edit`,
`listings.stock.edit`, `listings.brand.request`.

**Acceptance**: end-to-end listing→QC→live loop demoable (per §5 #1). Bulk upload
validates and reports row errors. Mobile card list works.

---

## Phase S3 — Orders & fulfilment (SM3)

**Screens**: All Orders (tabs: New / To-ship / Dispatched / Delivered / Cancelled),
Order detail (timeline, items, buyer-masked info, SLA clock), **Process flow**:
Confirm → Generate Invoice → Generate Label (shipping) → Add to Manifest →
Mark Dispatched; self-ship vs Arise-fulfilled branches; Bulk confirm/label/manifest;
Cancellations (seller-initiated + buyer requests); Order Exceptions.

**Seller API**: `GET /orders`, `GET /orders/:id`, `POST /orders/:id/confirm`,
`POST /orders/:id/invoice`, `POST /orders/:id/label`, `POST /orders/:id/manifest`,
`POST /orders/:id/dispatch`, `POST /orders/:id/cancel`, `POST /orders/bulk/:action`.

**Shared DB**: `orders`, `shipments`, `manifests` via shared `engine/orderState`
state machine (identical transitions to admin). **Admin Orders / Logistics** reflect
every transition live (§5 #2). SLA timers from shared settings.

**RBAC**: `orders.order.view|process|cancel`, `orders.label.generate`.

**Acceptance**: a seeded customer order flows seller-side confirm→dispatch and shows
synchronized in admin. SLA breach highlighting matches admin.

---

## Phase S4 — Returns, inventory & FBA (SM4)

**Screens**: Returns & Replacements (approve/reject, pickup tracking, QC on return),
RTO tracking, Inventory (by warehouse + self, editable), Low-stock alerts,
**FBA Inbound** creation wizard (send stock to Arise warehouse → `inboundConsignments`),
Removal orders, Stock adjustments history.

**Seller API**: `GET /returns`, `POST /returns/:id/decide`, `GET /inventory`,
`PATCH /inventory/:sku`, `POST /inbound`, `GET /inbound`, `POST /removals`,
`GET /warehouses` (Arise FCs the seller can use).

**Shared DB**: `returns`, `inventory`, `inventoryLedger`, `inboundConsignments`,
`inboundLines`, `removalOrders`. **Admin Warehouses/Inbound** receives the
consignment; receiving updates seller inventory (§5 loop). RTO via shared logistics
engine.

**RBAC**: `orders.return.manage`, `inventory.stock.view|edit`, `inventory.inbound.manage`.

**Acceptance**: FBA inbound created by seller appears in admin inbound; admin
"received" increments seller sellable inventory. Return approve → refund path begins.

---

## Phase S5 — Payments & finance (SM5)

**Screens**: Payments dashboard (next payout, on-hold, this-month earnings),
Settlement/Payout reports (batch list → batch detail with line items),
Transaction ledger (order-level: sale, commission, shipping fee, collection fee,
tax, net), Commission & fee schedule, Invoices (download), GST/TDS/TCS reports,
Reconciliation (expected vs settled), Payment holds explanation.

**Seller API**: `GET /finance/summary`, `GET /finance/settlements`,
`GET /finance/settlements/:id`, `GET /finance/transactions`,
`GET /finance/invoices`, `GET /finance/tax`, `GET /finance/reconciliation`,
`GET /finance/holds`.

**Shared DB**: `payoutBatches`, `settlementLines`, `invoices`, `taxSummaries`,
`reconciliation`, `codRemittances` — the **same rows admin Finance manages**, filtered
to the seller. Shared `engine/settlement` computes nets identically on both sides.

**RBAC**: `finance.payout.view`, `finance.transaction.view`, `finance.invoice.view`,
`finance.tax.view`.

**Acceptance**: seller settlement figures exactly reconcile with admin payout batch
detail for the same seller. CSV/xlsx export works.

---

## Phase S6 — Growth, promotions & ads (SM6)

**Screens**:
- *Promotions*: Deals/Flash-sale participation (opt-in nominations), Seller coupons
  (create/manage), Price recommendations.
- *Advertising*: Campaign list, Create campaign (sponsored products; budget,
  schedule, keywords/auto-targeting, bids), Campaign detail (spend, impressions,
  clicks, ACOS via `recharts`), Ad billing, Ad reports.

**Seller API**: `GET/POST /promotions/deals`, `GET/POST /coupons`,
`GET /pricing/recommendations`; `GET/POST /ads/campaigns`,
`PATCH /ads/campaigns/:id`, `GET /ads/campaigns/:id`, `GET /ads/billing`,
`GET /ads/reports`.

**Shared DB**: `deals`, `flashSales`, `coupons` (seller-scoped), `adCampaigns`,
`adCreatives`, `adBilling`. **Admin Marketing/Ads review** screens see seller
nominations and ad creatives for approval (§5 approval loop). Ad metrics from shared
ads engine.

**RBAC**: `promotions.deal.manage`, `promotions.coupon.manage`,
`ads.campaign.view|manage`, `ads.billing.view`.

**Acceptance**: seller campaign appears in admin Ad Review; approval flips it to
"serving". Deal nomination shows in admin deals calendar.

---

## Phase S7 — Performance & account health (SM7)

**Screens**: Account Health dashboard (composite score + gauges), SLA metrics
(cancellation %, RTO %, late-dispatch %, return %, defect rate — rolling windows),
Ratings & feedback, Policy/violation log, **Penalties** (levied by admin — view +
dispute), **SPF claims** (file, track, outcome), Performance trends (`recharts`).

**Seller API**: `GET /performance/health`, `GET /performance/metrics`,
`GET /performance/ratings`, `GET /penalties`, `POST /penalties/:id/dispute`,
`GET /claims`, `POST /claims`, `GET /claims/:id`.

**Shared DB**: `penalties`, `sellerClaims`, `sellerNotes`, review/rating rollups.
**Admin Penalties / Seller Claims** inboxes are the counterpart; admin decisions
flow back (§5 #3/#4). Metrics computed by shared engine so admin "Performance & SLA"
matches seller view exactly.

**RBAC**: `performance.view`, `claims.view|create`, `penalties.view|dispute`.

**Acceptance**: admin levies penalty → seller sees it and files a waiver claim →
admin decides → seller sees outcome. All metric numbers equal admin's for that seller.

---

## Phase S8 — Support, reports, settings & hardening (SM8)

**Screens**:
- *Support*: Raise ticket, My tickets (thread), Announcements/notifications center,
  Help/learning center (static pages).
- *Reports*: Report library (sales, returns, tax, inventory, ads), Scheduled
  reports, Export center (reuse admin reports patterns + `xlsx`).
- *Settings*: Business profile, GST/PAN, Bank accounts, Pickup addresses (CRUD),
  **Sub-users & roles** (invite, assign seller role, revoke), Notification
  preferences, Shipping settings (self-ship couriers/rates), **Vacation/Holiday
  mode** (pauses listings).
- *Hardening*: full responsive pass, dark mode parity, empty/loading/error states
  on every screen, a11y (focus, labels, keyboard), performance (route-level code
  splitting already per-page), and the **cross-module demo script** (§5 loops 1–4
  scripted as an e2e-style walkthrough).

**Seller API**: `GET/POST /support/tickets`, `GET /notifications`,
`GET /reports/*`, `POST /reports/schedule`, `GET /settings/*`,
`POST /settings/users/invite`, `PATCH /settings/users/:id`,
`POST /settings/vacation`.

**Shared DB**: `tickets`, `notifications`, `savedViews`, `settings`, seller
`adminUsers`-equivalent (sub-users), `pickupAddresses`, `bankAccounts`. Vacation mode
flips listing visibility consumed by admin + customer sides.

**RBAC**: `support.ticket.manage`, `settings.profile.edit`, `settings.user.manage`,
`settings.bank.manage`, `settings.vacation.manage`.

**Acceptance**: all nav items resolve to real screens; sub-user invite→accept→scoped
access works; vacation mode pauses listings (visible to admin). Full test suite +
the four demo loops pass.

---

# PART E — Cross-cutting standards, testing, Definition of Done

Carried over from `ADMIN_PANEL_PLAN.md §13–15`, applied to the seller module:

- **Every list screen**: URL-synced `DataTable`, `FilterBar`, column chooser, bulk
  actions, mobile card list, empty/error/loading states, CSV/xlsx export where useful.
- **Every mutation**: optimistic or invalidating React Query, success/error
  notifications, confirm modal for destructive/irreversible actions, seller-scoped.
- **Theming**: tokens from `@theme`; dark mode; seller accent (can differ from admin —
  e.g. a seller-brand accent) via token override only.
- **RBAC**: wrap gated UI in `Can`; route-level `RequirePermission` +
  `RequireActiveSeller`; sub-user scope respected.
- **i18n-ready, India-first**: ₹ formatting (`MoneyText`), IST dates, GST/HSN
  semantics.
- **Testing** (vitest + RTL): per-phase — seller `routes.test`, seller `rbac.test`,
  engine unit tests for any new shared engine logic, a seed sanity test, and
  component tests for the process-flow and onboarding wizards. Keep admin tests green.
- **Definition of Done per screen**: responsive ✓, dark ✓, empty/error/loading ✓,
  a11y ✓, permission-gated ✓, mock endpoint + seed ✓, test ✓, no eslint warnings.

---

# PART F — Risks, sequencing, open questions

**Sequencing**: Phase 0 (migration) must land and be verified **before** any seller
feature. Within Part D, S1→S3 unlock the first demoable two-sided loop; S4–S7 deepen
parity; S8 hardens. Each phase is an independently reviewable PR.

**Risks / mitigations**
- *Import churn in P0*: mitigated — only ~150 admin-only sites change; keep a
  `@shared→@ui` compat alias to defer the 836 UI-import rewrites. Run lint+tests as
  the gate.
- *Snapshot incompatibility*: bump `SNAPSHOT_VERSION` when seller collections/seed
  are added so stale browser snapshots re-seed.
- *Service-worker scope*: one worker serves both pages on the same origin; register
  the merged handler array. MSW handler ordering rules (literal before `:id`) apply
  per the existing `handlers/index.js` note — keep seller handlers in their own file
  set with the same discipline.
- *Cross-module import leakage*: eslint `no-restricted-imports` boundary rule.
- *Seller data isolation bugs*: every seller handler must filter/stamp `sellerId`;
  add a shared test helper asserting no seller endpoint returns another seller's rows.

**Open questions to confirm before S1**
1. Deploy model: separate subdomains (`admin.` / `seller.`) later, or one host with
   path prefixes? (Multi-entry supports both; affects router basename.)
2. Seller accent/branding: identical to admin theme, or a distinct seller accent?
3. Sub-user limit & which seller roles are "system" vs seller-editable.
4. Self-ship courier set for mock (reuse admin `couriers` seed?).
5. Should the seller panel share the admin login page shell visually, or get its own?
6. Scope of "price recommendations" / "growth tips" (heuristic mock vs omitted).

---

*End of plan. Next action after approval: execute Phase 0 as a single
no-behaviour-change PR, then proceed phase-by-phase.*
