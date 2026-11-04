import { customerAuthFixtureAdapter } from './customerAuthAdapter';
import { customerHomeFixtureAdapter } from './customerHomeAdapter';
import { customerCatalogFixtureAdapter } from './customerCatalogAdapter';
import { customerSearchProductFixtureAdapter } from './customerSearchProductAdapter';
import { customerWishlistFixtureAdapter } from './customerWishlistAdapter';
import { customerCartFixtureAdapter } from './customerCartAdapter';
import { customerAddressFixtureAdapter } from './customerAddressAdapter';
import { customerCheckoutPaymentFixtureAdapter } from './customerCheckoutPaymentAdapter';
import { customerOrdersFixtureAdapter } from './customerOrdersAdapter';
import { customerReturnsFixtureAdapter } from './customerReturnsAdapter';
import { customerTrackingFixtureAdapter } from './customerTrackingAdapter';
import { customerMediaFixtureAdapter } from './customerMediaAdapter';
import { customerReviewsFixtureAdapter } from './customerReviewsAdapter';
import { customerQuestionsFixtureAdapter } from './customerQuestionsAdapter';
import { customerProfileFixtureAdapter } from './customerProfileAdapter';
import { customerPrivacyFixtureAdapter } from './customerPrivacyAdapter';
import { customerWalletFixtureAdapter } from './customerWalletAdapter';
import { customerNotificationsFixtureAdapter } from './customerNotificationsAdapter';
import { customerSupportFixtureAdapter } from './customerSupportAdapter';
import { customerExperienceFixtureAdapter } from './customerExperienceAdapter';
import { customerPaymentMethodsFixtureAdapter } from './customerPaymentMethodsAdapter';
import { customerSellerFixtureAdapter } from './customerSellerAdapter';

export const customerFixtureAdapter = config => {
  if (config.url === '/health') return customerExperienceFixtureAdapter(config);
  if (config.url?.startsWith('/seller-leads')) return customerSellerFixtureAdapter(config);
  if (config.url?.startsWith('/payment-methods'))
    return customerPaymentMethodsFixtureAdapter(config);
  if (
    config.url?.startsWith('/promotions') ||
    config.url?.startsWith('/flash-sales') ||
    config.url === '/me/recently-viewed' ||
    config.url === '/coupons/available' ||
    config.url === '/me/ad-preferences'
  )
    return customerExperienceFixtureAdapter(config);
  if (config.url?.startsWith('/auth')) return customerAuthFixtureAdapter(config);
  if (config.url === '/me') return customerProfileFixtureAdapter(config);
  if (config.url?.startsWith('/privacy') || config.url === '/me/communication-preferences')
    return customerPrivacyFixtureAdapter(config);
  if (
    config.url?.startsWith('/wallet') ||
    config.url?.startsWith('/gift-cards') ||
    config.url?.startsWith('/referrals')
  )
    return customerWalletFixtureAdapter(config);
  if (config.url?.startsWith('/notifications') || config.url?.startsWith('/devices/push-tokens'))
    return customerNotificationsFixtureAdapter(config);
  if (config.url?.startsWith('/support') || config.url?.startsWith('/help'))
    return customerSupportFixtureAdapter(config);
  if (config.url?.startsWith('/media')) return customerMediaFixtureAdapter(config);
  if (
    config.url?.startsWith('/reviews') ||
    config.url?.includes('/reviews') ||
    config.url?.includes('/review-eligibility')
  )
    return customerReviewsFixtureAdapter(config);
  if (
    config.url?.startsWith('/questions') ||
    config.url?.startsWith('/answers') ||
    config.url?.includes('/questions')
  )
    return customerQuestionsFixtureAdapter(config);
  if (config.url?.startsWith('/shipments')) return customerTrackingFixtureAdapter(config);
  if (
    config.url?.startsWith('/checkout') ||
    config.url?.startsWith('/payments') ||
    (config.url === '/orders' && config.method === 'post')
  ) {
    return customerCheckoutPaymentFixtureAdapter(config);
  }
  if (config.url?.startsWith('/returns') || config.url?.includes('/returnable-items')) {
    return customerReturnsFixtureAdapter(config);
  }
  if (config.url?.startsWith('/orders')) return customerOrdersFixtureAdapter(config);
  if (config.url?.startsWith('/addresses') || config.url?.startsWith('/serviceability')) {
    return customerAddressFixtureAdapter(config);
  }
  if (config.url?.startsWith('/cart') || config.url?.startsWith('/coupons')) {
    return customerCartFixtureAdapter(config);
  }
  if (config.url?.startsWith('/wishlist')) return customerWishlistFixtureAdapter(config);
  if (config.url?.startsWith('/categories') || config.url === '/brands') {
    return customerCatalogFixtureAdapter(config);
  }
  if (config.url?.startsWith('/search') || config.url?.startsWith('/products/')) {
    return customerSearchProductFixtureAdapter(config);
  }
  return customerHomeFixtureAdapter(config);
};
