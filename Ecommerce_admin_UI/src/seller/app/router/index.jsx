import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import SellerLayout from '@seller/layouts/SellerLayout';
import SellerAuthLayout from '@seller/layouts/SellerAuthLayout';
import {
  RequireActiveSeller,
  RequireAnonymous,
  RequireAuth,
  RequirePermission,
} from './guards';
import SessionBootstrap from './SessionBootstrap';

/* Route-level code splitting: each page is its own chunk. */
const LoginPage = lazy(() => import('@seller/features/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('@seller/features/auth/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@seller/features/auth/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@seller/features/auth/pages/ResetPasswordPage'));
const AcceptInvitePage = lazy(() => import('@seller/features/auth/pages/AcceptInvitePage'));
const ChangePasswordPage = lazy(() => import('@seller/features/auth/pages/ChangePasswordPage'));

const OnboardingStatusPage = lazy(
  () => import('@seller/features/onboarding/pages/OnboardingStatusPage'),
);
const DashboardPage = lazy(() => import('@seller/features/dashboard/pages/DashboardPage'));
const MyAccountPage = lazy(() => import('@seller/features/me/pages/MyAccountPage'));

/* Phase S2 — listings */
const ListingsPage = lazy(() => import('@seller/features/listings/pages/ListingsPage'));
const AddProductPage = lazy(() => import('@seller/features/listings/pages/AddProductPage'));
const NewProductPage = lazy(() => import('@seller/features/listings/pages/NewProductPage'));
const CatalogSearchPage = lazy(() => import('@seller/features/listings/pages/CatalogSearchPage'));
const CatalogProductPage = lazy(() => import('@seller/features/listings/pages/CatalogProductPage'));
const BulkUploadPage = lazy(() => import('@seller/features/listings/pages/BulkUploadPage'));
const BrandRequestsPage = lazy(() => import('@seller/features/listings/pages/BrandRequestsPage'));
const ListingDetailPage = lazy(() => import('@seller/features/listings/pages/ListingDetailPage'));

/* Phase S3 — orders & fulfilment */
const OrdersPage = lazy(() => import('@seller/features/orders/pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('@seller/features/orders/pages/OrderDetailPage'));
const CancellationsPage = lazy(() => import('@seller/features/orders/pages/CancellationsPage'));
const ProcessingPage = lazy(() => import('@seller/features/orders/pages/ProcessingPage'));
const LogisticsListPage = lazy(() => import('@seller/features/logistics/pages/LogisticsListPage'));

/* Phase S4 — returns, inventory & FBA inbound */
const ReturnsPage = lazy(() => import('@seller/features/returns/pages/ReturnsPage'));
const ReturnDetailPage = lazy(() => import('@seller/features/returns/pages/ReturnDetailPage'));
const ReturnDisputePage = lazy(() => import('@seller/features/returns/pages/ReturnDisputePage'));
const InventoryPage = lazy(() => import('@seller/features/inventory/pages/InventoryPage'));
const InboundPage = lazy(() => import('@seller/features/inventory/pages/InboundPage'));
const InboundDetailPage = lazy(() => import('@seller/features/inventory/pages/InboundDetailPage'));
const InventoryLedgerPage = lazy(() => import('@seller/features/inventory/pages/InventoryLedgerPage'));

/* Phase S5 — payments & finance */
const PaymentsPage = lazy(() => import('@seller/features/finance/pages/PaymentsPage'));
const SettlementsPage = lazy(() => import('@seller/features/finance/pages/SettlementsPage'));
const PayoutDetailPage = lazy(() => import('@seller/features/finance/pages/PayoutDetailPage'));
const TransactionsPage = lazy(() => import('@seller/features/finance/pages/TransactionsPage'));
const InvoicesPage = lazy(() => import('@seller/features/finance/pages/InvoicesPage'));
const ReconciliationPage = lazy(() => import('@seller/features/finance/pages/ReconciliationPage'));
const FeesPage = lazy(() => import('@seller/features/finance/pages/FeesPage'));

/* Phase S6 — growth, promotions & ads */
const AdCampaignsPage = lazy(() => import('@seller/features/ads/pages/CampaignsPage'));
const CreateCampaignPage = lazy(() => import('@seller/features/ads/pages/CreateCampaignPage'));
const CampaignDetailPage = lazy(() => import('@seller/features/ads/pages/CampaignDetailPage'));
const FlashSalesPage = lazy(() => import('@seller/features/promotions/pages/FlashSalesPage'));
const NominationsPage = lazy(() => import('@seller/features/promotions/pages/NominationsPage'));
const CouponsPage = lazy(() => import('@seller/features/promotions/pages/CouponsPage'));

/* Phase S7 — performance & account health */
const AccountHealthPage = lazy(
  () => import('@seller/features/performance/pages/AccountHealthPage'),
);
const PenaltiesPage = lazy(() => import('@seller/features/performance/pages/PenaltiesPage'));
const ClaimsPage = lazy(() => import('@seller/features/performance/pages/ClaimsPage'));

/* Phase S16 — customer experience */
const CustomerReviewsPage = lazy(() => import('@seller/features/customerExperience/pages/ReviewsPage'));
const CustomerQuestionsPage = lazy(() => import('@seller/features/customerExperience/pages/QuestionsPage'));
const CustomerMessagesPage = lazy(() => import('@seller/features/customerExperience/pages/MessagesPage'));

/* Phase S17 — analytics, insights & recommendations */
const AnalyticsPage = lazy(() => import('@seller/features/analytics/pages/AnalyticsPage'));
const RecommendationsPage = lazy(() => import('@seller/features/analytics/pages/RecommendationsPage'));

/* Phase S18 — team security and integrations */
const SecurityPage = lazy(() => import('@seller/features/security/pages/SecurityPage'));
const RolesPage = lazy(() => import('@seller/features/security/pages/RolesPage'));
const IntegrationsPage = lazy(() => import('@seller/features/security/pages/IntegrationsPage'));
const ApiKeysPage = lazy(() => import('@seller/features/security/pages/ApiKeysPage'));
const WebhooksPage = lazy(() => import('@seller/features/security/pages/WebhooksPage'));
const AuditPage = lazy(() => import('@seller/features/security/pages/AuditPage'));

/* Phase S8 — support, reports, settings & hardening */
const SupportPage = lazy(() => import('@seller/features/support/pages/SupportPage'));
const TicketDetailPage = lazy(() => import('@seller/features/support/pages/TicketDetailPage'));
const ReportsPage = lazy(() => import('@seller/features/reports/pages/ReportsPage'));
const ProfilePage = lazy(() => import('@seller/features/settings/pages/ProfilePage'));
const BankPickupPage = lazy(() => import('@seller/features/settings/pages/BankPickupPage'));
const WarehousesPage = lazy(() => import('@seller/features/settings/pages/WarehousesPage'));
const UsersRolesPage = lazy(() => import('@seller/features/settings/pages/UsersRolesPage'));
const NotificationsPage = lazy(() => import('@seller/features/settings/pages/NotificationsPage'));
const NotFoundPage = lazy(() => import('@seller/features/system/pages/NotFoundPage'));

function gated(perm, element) {
  return <RequirePermission perm={perm}>{element}</RequirePermission>;
}

/** Every seller navigation destination is backed by a production screen. */
const IMPLEMENTED = [
  { path: '/', element: gated('dashboard.dashboard.view', <DashboardPage />) },
  { path: '/account', element: <MyAccountPage /> },

  // Listings (Phase S2)
  { path: '/listings', element: gated('listings.product.view', <ListingsPage />) },
  { path: '/listings/new', element: gated('listings.product.create', <AddProductPage />) },
  { path: '/listings/new/create', element: gated('catalog.product.propose', <NewProductPage />) },
  { path: '/catalog/search', element: gated('catalog.product.view', <CatalogSearchPage />) },
  { path: '/catalog/products/:id', element: gated('catalog.product.view', <CatalogProductPage />) },
  { path: '/listings/bulk', element: gated('listings.product.create', <BulkUploadPage />) },
  { path: '/listings/bulk-jobs', element: gated('catalog.bulk_job.view', <BulkUploadPage />) },
  { path: '/listings/requests', element: gated('listings.brand.request', <BrandRequestsPage />) },
  { path: '/listings/:id', element: gated('listings.product.view', <ListingDetailPage />) },

  // Orders (Phase S3)
  { path: '/orders', element: gated('orders.order.view', <OrdersPage />) },
  { path: '/orders/processing', element: gated('logistics.shipment.view', <ProcessingPage />) },
  { path: '/orders/cancellations', element: gated('orders.order.view', <CancellationsPage />) },
  { path: '/orders/:id', element: gated('orders.order.view', <OrderDetailPage />) },
  {
    path: '/logistics/pickups',
    element: gated('logistics.pickup.view', <LogisticsListPage kind="pickups" />),
  },
  {
    path: '/logistics/shipments',
    element: gated('logistics.shipment.view', <LogisticsListPage kind="shipments" />),
  },
  {
    path: '/logistics/ndr',
    element: gated('logistics.ndr.view', <LogisticsListPage kind="ndr" />),
  },
  {
    path: '/logistics/rto',
    element: gated('logistics.rto.view', <LogisticsListPage kind="rto" />),
  },
  {
    path: '/logistics/weight-disputes',
    element: gated('logistics.weight_dispute.view', <LogisticsListPage kind="weight-disputes" />),
  },

  // Returns, inventory & FBA inbound (Phase S4)
  { path: '/returns', element: gated('orders.return.manage', <ReturnsPage />) },
  { path: '/returns/:id/dispute', element: gated('returns.dispute.create', <ReturnDisputePage />) },
  { path: '/returns/:id', element: gated('orders.return.manage', <ReturnDetailPage />) },
  { path: '/inventory', element: gated('inventory.stock.view', <InventoryPage />) },
  { path: '/inventory/ledger/:inventoryId', element: gated('inventory.stock.view', <InventoryLedgerPage />) },
  { path: '/inventory/inbound', element: gated('inventory.inbound.manage', <InboundPage />) },
  {
    path: '/inventory/inbound/:id',
    element: gated('inventory.inbound.manage', <InboundDetailPage />),
  },

  // Payments & finance (Phase S5)
  { path: '/payments', element: gated('finance.payout.view', <PaymentsPage />) },
  { path: '/payments/settlements', element: gated('finance.payout.view', <SettlementsPage />) },
  {
    path: '/payments/settlements/:id',
    element: gated('finance.payout.view', <PayoutDetailPage />),
  },
  {
    path: '/payments/transactions',
    element: gated('finance.transaction.view', <TransactionsPage />),
  },
  { path: '/payments/invoices', element: gated('finance.invoice.view', <InvoicesPage />) },
  { path: '/payments/reconciliation', element: gated('finance.reconciliation.view', <ReconciliationPage />) },
  { path: '/payments/fees', element: gated('finance.fee.view', <FeesPage />) },

  // Growth, promotions & ads (Phase S6)
  { path: '/ads', element: gated('ads.campaign.view', <AdCampaignsPage />) },
  { path: '/ads/new', element: gated('ads.campaign.manage', <CreateCampaignPage />) },
  { path: '/ads/:id', element: gated('ads.campaign.view', <CampaignDetailPage />) },
  { path: '/promotions', element: gated('promotions.deal.manage', <FlashSalesPage />) },
  {
    path: '/promotions/nominations',
    element: gated('promotions.deal.manage', <NominationsPage />),
  },
  { path: '/promotions/coupons', element: gated('promotions.coupon.manage', <CouponsPage />) },

  // Performance & account health (Phase S7)
  { path: '/performance', element: gated('performance.health.view', <AccountHealthPage />) },
  { path: '/performance/penalties', element: gated('performance.penalty.view', <PenaltiesPage />) },
  { path: '/performance/claims', element: gated('performance.claim.view', <ClaimsPage />) },

  // Customer experience (Phase S16)
  { path: '/customer-experience/reviews', element: gated('customer_experience.review.view', <CustomerReviewsPage />) },
  { path: '/customer-experience/questions', element: gated('customer_experience.question.view', <CustomerQuestionsPage />) },
  { path: '/customer-experience/messages', element: gated('customer_experience.message.view', <CustomerMessagesPage />) },

  // Analytics (Phase S17)
  { path: '/analytics/overview', element: gated('analytics.dashboard.view', <AnalyticsPage view="overview" />) },
  { path: '/analytics/products', element: gated('analytics.dashboard.view', <AnalyticsPage view="products" />) },
  { path: '/analytics/traffic', element: gated('analytics.dashboard.view', <AnalyticsPage view="traffic" />) },
  { path: '/analytics/operations', element: gated('analytics.dashboard.view', <AnalyticsPage view="operations" />) },
  { path: '/analytics/finance', element: gated('analytics.dashboard.view', <AnalyticsPage view="finance" />) },
  { path: '/analytics/recommendations', element: gated('analytics.recommendation.view', <RecommendationsPage />) },

  // Support, reports & settings (Phase S8)
  { path: '/support', element: gated('support.ticket.view', <SupportPage />) },
  { path: '/support/:id', element: gated('support.ticket.view', <TicketDetailPage />) },
  { path: '/reports', element: gated('reports.report.view', <ReportsPage />) },
  { path: '/settings/profile', element: gated('settings.profile.view', <ProfilePage />) },
  { path: '/settings/bank', element: gated('settings.bank.manage', <BankPickupPage />) },
  { path: '/settings/warehouses', element: gated('settings.pickup.manage', <WarehousesPage />) },
  { path: '/settings/users', element: gated('settings.user.view', <UsersRolesPage />) },
  { path: '/settings/roles', element: gated('security.role.view', <RolesPage />) },
  { path: '/settings/security', element: gated('security.session.view', <SecurityPage />) },
  { path: '/settings/integrations', element: gated('security.webhook.view', <IntegrationsPage />) },
  { path: '/settings/api-keys', element: gated('security.api_key.view', <ApiKeysPage />) },
  { path: '/settings/webhooks', element: gated('security.webhook.view', <WebhooksPage />) },
  { path: '/settings/audit', element: gated('security.audit.view', <AuditPage />) },
  {
    path: '/settings/notifications',
    element: gated('settings.notification.manage', <NotificationsPage />),
  },
];

export const router = createBrowserRouter(
  [
    {
      element: <SessionBootstrap />,
      children: [
        {
          element: <RequireAnonymous />,
          children: [
            {
              element: <SellerAuthLayout />,
              children: [
                { path: '/login', element: <LoginPage /> },
                { path: '/register', element: <RegisterPage /> },
                { path: '/application-status', element: <OnboardingStatusPage /> },
                { path: '/forgot-password', element: <ForgotPasswordPage /> },
                { path: '/reset-password', element: <ResetPasswordPage /> },
                { path: '/accept-invite', element: <AcceptInvitePage /> },
              ],
            },
          ],
        },
        {
          element: <RequireAuth />,
          children: [
            { path: '/change-password', element: <ChangePasswordPage /> },
            {
              // The main shell: active sellers only.
              element: <RequireActiveSeller />,
              children: [
                {
                  element: <SellerLayout />,
                  children: [...IMPLEMENTED, { path: '*', element: <NotFoundPage /> }],
                },
              ],
            },
          ],
        },
        { path: '/logout', element: <Navigate to="/login" replace /> },
      ],
    },
  ],
  { basename: '/seller' },
);
