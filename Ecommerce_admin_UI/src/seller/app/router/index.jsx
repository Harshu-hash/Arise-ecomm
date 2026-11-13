import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import SellerLayout from '@seller/layouts/SellerLayout';
import SellerAuthLayout from '@seller/layouts/SellerAuthLayout';
import { RequireActiveSeller, RequireAnonymous, RequireAuth } from './guards';
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

/* Listings (incl. the Add Product flow) */
const ListingsPage = lazy(() => import('@seller/features/listings/pages/ListingsPage'));
const AddProductPage = lazy(() => import('@seller/features/listings/pages/AddProductPage'));
const NewProductPage = lazy(() => import('@seller/features/listings/pages/NewProductPage'));
const CatalogSearchPage = lazy(() => import('@seller/features/listings/pages/CatalogSearchPage'));
const CatalogProductPage = lazy(() => import('@seller/features/listings/pages/CatalogProductPage'));
const ListingDetailPage = lazy(() => import('@seller/features/listings/pages/ListingDetailPage'));

/* Campaigns (promotions the seller joins) */
const CampaignsPage = lazy(() => import('@seller/features/campaigns/pages/CampaignsPage'));
const CampaignDetailPage = lazy(() => import('@seller/features/campaigns/pages/CampaignDetailPage'));

/* Orders & returns */
const OrdersPage = lazy(() => import('@seller/features/orders/pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('@seller/features/orders/pages/OrderDetailPage'));
const ReturnsPage = lazy(() => import('@seller/features/returns/pages/ReturnsPage'));
const ReturnDetailPage = lazy(() => import('@seller/features/returns/pages/ReturnDetailPage'));

/* Payments */
const PaymentsPage = lazy(() => import('@seller/features/finance/pages/PaymentsPage'));
const SettlementsPage = lazy(() => import('@seller/features/finance/pages/SettlementsPage'));
const PayoutDetailPage = lazy(() => import('@seller/features/finance/pages/PayoutDetailPage'));

/* Support & account */
const SupportPage = lazy(() => import('@seller/features/support/pages/SupportPage'));
const TicketDetailPage = lazy(() => import('@seller/features/support/pages/TicketDetailPage'));
const ProfilePage = lazy(() => import('@seller/features/settings/pages/ProfilePage'));
const BankPickupPage = lazy(() => import('@seller/features/settings/pages/BankPickupPage'));
const NotFoundPage = lazy(() => import('@seller/features/system/pages/NotFoundPage'));

/** Every seller navigation destination is backed by a production screen. */
const ROUTES = [
  { path: '/', element: <DashboardPage /> },
  { path: '/account', element: <MyAccountPage /> },

  // Products (My Listings + Add Product flow)
  { path: '/listings', element: <ListingsPage /> },
  { path: '/listings/new', element: <AddProductPage /> },
  { path: '/listings/new/create', element: <NewProductPage /> },
  { path: '/catalog/search', element: <CatalogSearchPage /> },
  { path: '/catalog/products/:id', element: <CatalogProductPage /> },
  { path: '/listings/:id', element: <ListingDetailPage /> },

  // Campaigns
  { path: '/campaigns', element: <CampaignsPage /> },
  { path: '/campaigns/:id', element: <CampaignDetailPage /> },

  // Orders & returns
  { path: '/orders', element: <OrdersPage /> },
  { path: '/orders/:id', element: <OrderDetailPage /> },
  { path: '/returns', element: <ReturnsPage /> },
  { path: '/returns/:id', element: <ReturnDetailPage /> },

  // Payments
  { path: '/payments', element: <PaymentsPage /> },
  { path: '/payments/settlements', element: <SettlementsPage /> },
  { path: '/payments/settlements/:id', element: <PayoutDetailPage /> },

  // Support & account
  { path: '/support', element: <SupportPage /> },
  { path: '/support/:id', element: <TicketDetailPage /> },
  { path: '/settings/profile', element: <ProfilePage /> },
  { path: '/settings/bank', element: <BankPickupPage /> },
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
                  children: [...ROUTES, { path: '*', element: <NotFoundPage /> }],
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
