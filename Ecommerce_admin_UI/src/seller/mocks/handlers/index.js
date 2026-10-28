import { sellerAuthHandlers } from './auth';
import { sellerMeHandlers } from './me';
import { sellerOnboardingHandlers } from './onboarding';
import { sellerDashboardHandlers } from './dashboard';
import { sellerCatalogHandlers } from './catalog';
import { sellerListingHandlers } from './listings';
import { sellerOrderHandlers } from './orders';
import { sellerFulfilmentHandlers } from './fulfilment';
import { sellerFinanceHandlers } from './finance';
import { sellerGrowthHandlers } from './growth';
import { sellerPerformanceHandlers } from './performance';
import { sellerSupportHandlers } from './support';
import { sellerSettingsHandlers } from './settings';

/**
 * All seller-panel request handlers, served at `/api/seller/v1`. They read and
 * write the same shared DB the admin handlers use, scoped to the signed-in
 * seller. Literal paths are declared before any `:param` sibling (MSW matches
 * first-wins), as in the admin handler index.
 */
export const sellerHandlers = [
  ...sellerAuthHandlers,
  ...sellerMeHandlers,
  ...sellerOnboardingHandlers,
  ...sellerDashboardHandlers,
  ...sellerCatalogHandlers,
  ...sellerListingHandlers,
  ...sellerOrderHandlers,
  ...sellerFulfilmentHandlers,
  ...sellerFinanceHandlers,
  ...sellerGrowthHandlers,
  ...sellerPerformanceHandlers,
  ...sellerSupportHandlers,
  ...sellerSettingsHandlers,
];
