import { bannerAdsApi } from './api/bannerAds.api';

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
let loading;

function loadScript() {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.onload = resolve;
    script.onerror = () => {
      loading = undefined; // let a later attempt retry
      reject(new Error('Could not load Razorpay. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Opens Razorpay Checkout for a held booking and, once the payer completes it, sends the signed result
 * to the backend, which verifies the signature before the booking enters admin review.
 * Rejects with `cancelled: true` when the payer closes the window (the dates stay held for a few minutes).
 */
export async function payForBooking({ bookingId, providerOrderId, amountPaise, currency = 'INR', keyId }, { description }) {
  await loadScript();
  const result = await new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: keyId,
      order_id: providerOrderId,
      amount: amountPaise,
      currency,
      name: 'Arise Seller',
      description,
      handler: (response) => resolve({ providerPaymentId: response.razorpay_payment_id, signature: response.razorpay_signature }),
      modal: { ondismiss: () => reject(Object.assign(new Error('Payment was not completed. Your dates are held for 15 minutes; pay from the banner list to keep them.'), { cancelled: true })) },
    });
    checkout.on('payment.failed', (response) => reject(new Error(response.error?.description ?? 'The payment failed. Try again.')));
    checkout.open();
  });
  return bannerAdsApi.confirmPayment(bookingId, result);
}
