import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import AppLayout from '@admin/layouts/AppLayout';
import AuthLayout from '@admin/layouts/AuthLayout';
import { SHOW_DEV_TOOLS } from '@core/config/env';
import { RequireAnonymous, RequireAuth, RequireNavAccess } from './guards';
import SessionBootstrap from './SessionBootstrap';

/* Route-level code splitting: each page is its own chunk. */
const LoginPage = lazy(() => import('@admin/features/auth/pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@admin/features/auth/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@admin/features/auth/pages/ResetPasswordPage'));
const AcceptInvitePage = lazy(() => import('@admin/features/auth/pages/AcceptInvitePage'));
const ChangePasswordPage = lazy(() => import('@admin/features/auth/pages/ChangePasswordPage'));

const DashboardPage = lazy(() => import('@admin/features/dashboard/pages/DashboardPage'));
const AnalyticsPage = lazy(() => import('@admin/features/analytics/pages/AnalyticsPage'));

/* Sellers */
const SellersListPage = lazy(() => import('@admin/features/sellers/pages/SellersListPage'));
const SellerApplicationsPage = lazy(() => import('@admin/features/sellers/pages/SellerApplicationsPage'));
const SellerInquiriesPage = lazy(() => import('@admin/features/sellers/pages/SellerInquiriesPage'));
const SellerApplicationReviewPage = lazy(() => import('@admin/features/sellers/pages/SellerApplicationReviewPage'));
const SellerDetailPage = lazy(() => import('@admin/features/sellers/pages/SellerDetailPage'));

/* Orders & customers */
const OrdersListPage = lazy(() => import('@admin/features/orders/pages/OrdersListPage'));
const OrderDetailPage = lazy(() => import('@admin/features/orders/pages/OrderDetailPage'));
const ReturnsPage = lazy(() => import('@admin/features/orders/pages/ReturnsPage'));
const ReturnDetailPage = lazy(() => import('@admin/features/orders/pages/ReturnDetailPage'));
const CustomersListPage = lazy(() => import('@admin/features/customers/pages/CustomersListPage'));
const CustomerDetailPage = lazy(() => import('@admin/features/customers/pages/CustomerDetailPage'));

/* Shipments (third-party delivery integration will extend this later) */
const ShipmentsPage = lazy(() => import('@admin/features/logistics/pages/ShipmentsPage'));

const ApprovalsPage = lazy(() => import('@admin/features/approvals/pages/ApprovalsPage'));

/* Reviews & support */
const ReviewsPage = lazy(() => import('@admin/features/reviews/pages/ReviewsPage'));
const QaPage = lazy(() => import('@admin/features/reviews/pages/QaPage'));
const LiveChatPage = lazy(() => import('@admin/features/support/pages/LiveChatPage'));
const AriseRatingsPage = lazy(() => import('@admin/features/support/pages/AriseRatingsPage'));

/* Marketing & content */
const CampaignsListPage = lazy(() => import('@admin/features/campaigns/pages/CampaignsListPage'));
const CampaignDetailPage = lazy(() => import('@admin/features/campaigns/pages/CampaignDetailPage'));
const CouponsListPage = lazy(() => import('@admin/features/marketing/pages/CouponsListPage'));
const DealsPage = lazy(() => import('@admin/features/marketing/pages/DealsPage'));
const ReferralPage = lazy(() => import('@admin/features/marketing/pages/ReferralPage'));
const GiftCardsPage = lazy(() => import('@admin/features/marketing/pages/GiftCardsPage'));
const CashbackRulesPage = lazy(() => import('@admin/features/marketing/pages/CashbackRulesPage'));
const HomeLayoutPage = lazy(() => import('@admin/features/cms/pages/HomeLayoutPage'));
const BannersPage = lazy(() => import('@admin/features/cms/pages/BannersPage'));
const BannerAdsPage = lazy(() => import('@admin/features/bannerAds/pages/BannerAdsPage'));
const PushBroadcastPage = lazy(() => import('@admin/features/notifications/pages/PushBroadcastPage'));
const StaticPagesPage = lazy(() => import('@admin/features/cms/pages/StaticPagesPage'));
const AboutArisePage = lazy(() => import('@admin/features/cms/pages/AboutArisePage'));

/* Finance */
const PaymentsPage = lazy(() => import('@admin/features/finance/pages/PaymentsPage'));
const RefundsPage = lazy(() => import('@admin/features/finance/pages/RefundsPage'));
const InvoicesPage = lazy(() => import('@admin/features/finance/pages/InvoicesPage'));
const SellerSettlementsPage = lazy(() => import('@admin/features/finance/pages/SellerSettlementsPage'));
const WithdrawalsPage = lazy(() => import('@admin/features/finance/pages/WithdrawalsPage'));

/* Catalog */
const ProductsListPage = lazy(() => import('@admin/features/catalog/pages/ProductsListPage'));
const ProductDetailPage = lazy(() => import('@admin/features/catalog/pages/ProductDetailPage'));
const CategoriesPage = lazy(() => import('@admin/features/catalog/pages/CategoriesPage'));
const BrandsPage = lazy(() => import('@admin/features/catalog/pages/BrandsPage'));
const AttributesPage = lazy(() => import('@admin/features/catalog/pages/AttributesPage'));
const SizeChartsPage = lazy(() => import('@admin/features/catalog/pages/SizeChartsPage'));

/* Settings & staff */
const PlatformSettingsPage = lazy(() => import('@admin/features/settings/pages/PlatformSettingsPage'));
const AdminUsersListPage = lazy(() => import('@admin/features/adminUsers/pages/AdminUsersListPage'));
const AdminUserDetailPage = lazy(() => import('@admin/features/adminUsers/pages/AdminUserDetailPage'));
const RolesListPage = lazy(() => import('@admin/features/roles/pages/RolesListPage'));

const MyAccountPage = lazy(() => import('@admin/features/me/pages/MyAccountPage'));
const ComponentGalleryPage = lazy(() => import('@admin/features/dev/pages/ComponentGalleryPage'));
const NotFoundPage = lazy(() => import('@admin/features/system/pages/NotFoundPage'));

/** Every route in the simplified admin panel. */
const ROUTES = [
  { path: '/', element: <DashboardPage /> },
  { path: '/analytics', element: <AnalyticsPage /> },

  // Catalog
  { path: '/catalog/products', element: <ProductsListPage /> },
  { path: '/catalog/products/:id', element: <ProductDetailPage /> },
  { path: '/catalog/categories', element: <CategoriesPage /> },
  { path: '/catalog/brands', element: <BrandsPage /> },
  { path: '/catalog/attributes', element: <AttributesPage /> },
  { path: '/catalog/size-charts', element: <SizeChartsPage /> },

  // Orders
  { path: '/orders', element: <OrdersListPage /> },
  { path: '/orders/:id', element: <OrderDetailPage /> },
  { path: '/returns', element: <ReturnsPage /> },
  { path: '/returns/:id', element: <ReturnDetailPage /> },
  { path: '/logistics/shipments', element: <ShipmentsPage /> },

  // Sellers
  { path: '/sellers', element: <SellersListPage /> },
  { path: '/sellers/applications', element: <SellerApplicationsPage /> },
  { path: '/sellers/inquiries', element: <SellerInquiriesPage /> },
  { path: '/sellers/:id', element: <SellerDetailPage /> },
  { path: '/sellers/:id/review', element: <SellerApplicationReviewPage /> },

  // Customers
  { path: '/customers', element: <CustomersListPage /> },
  { path: '/customers/:id', element: <CustomerDetailPage /> },

  // Marketing & content
  { path: '/campaigns', element: <CampaignsListPage /> },
  { path: '/campaigns/:id', element: <CampaignDetailPage /> },
  { path: '/marketing/coupons', element: <CouponsListPage /> },
  { path: '/marketing/deals', element: <DealsPage /> },
  { path: '/marketing/referrals', element: <ReferralPage /> },
  { path: '/marketing/gift-cards', element: <GiftCardsPage /> },
  { path: '/marketing/cashback', element: <CashbackRulesPage /> },
  { path: '/cms/banners', element: <BannersPage /> },
  { path: '/marketing/banner-ads', element: <BannerAdsPage /> },
  { path: '/marketing/push-notifications', element: <PushBroadcastPage /> },
  { path: '/cms/home', element: <HomeLayoutPage /> },
  { path: '/cms/pages', element: <StaticPagesPage /> },
  { path: '/cms/about-arise', element: <AboutArisePage /> },

  // Finance
  { path: '/finance/payments', element: <PaymentsPage /> },
  { path: '/finance/refunds', element: <RefundsPage /> },
  { path: '/finance/invoices', element: <InvoicesPage /> },
  { path: '/finance/payouts', element: <SellerSettlementsPage /> },
  { path: '/finance/withdrawals', element: <WithdrawalsPage /> },

  // Reviews & support
  { path: '/reviews', element: <ReviewsPage /> },
  { path: '/reviews/qa', element: <QaPage /> },
  { path: '/support/chat', element: <LiveChatPage /> },
  { path: '/support/arise-ratings', element: <AriseRatingsPage /> },
  { path: '/admin/approvals', element: <ApprovalsPage /> },

  // Settings & staff
  { path: '/admin/settings', element: <PlatformSettingsPage /> },
  { path: '/admin/users', element: <AdminUsersListPage /> },
  { path: '/admin/users/:id', element: <AdminUserDetailPage /> },
  { path: '/admin/roles', element: <RolesListPage /> },

  { path: '/me', element: <MyAccountPage /> },
  { path: '/change-password', element: <ChangePasswordPage /> },
];

export const router = createBrowserRouter([
  {
    element: <SessionBootstrap />,
    children: [
      {
        element: <RequireAnonymous />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: '/login', element: <LoginPage /> },
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
          {
            element: <AppLayout />,
            children: [
              { element: <RequireNavAccess />, children: ROUTES },
              ...(SHOW_DEV_TOOLS
                ? [{ path: '/dev/components', element: <ComponentGalleryPage /> }]
                : []),
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
      // A stray /logout link should land somewhere sensible rather than 404.
      { path: '/logout', element: <Navigate to="/login" replace /> },
    ],
  },
]);
