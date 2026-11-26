import { baseApi } from '@core/api/baseApi';
import { safeIdempotencyKey } from '@core/api/idempotency';
import { CHECKOUT_ENDPOINTS } from './checkout.endpoints';
import { mapCheckoutPreview, mapCheckoutSession } from './checkout.mapper';

export const checkoutApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    createCheckoutSession: builder.mutation({
      query: ({ idempotencyKey, ...data }) => ({
        url: CHECKOUT_ENDPOINTS.sessions,
        method: 'POST',
        data,
        headers: { 'Idempotency-Key': safeIdempotencyKey(idempotencyKey) },
      }),
      transformResponse: mapCheckoutSession,
      invalidatesTags: [{ type: 'Checkout', id: 'CURRENT' }],
    }),
    getCheckoutPreview: builder.query({
      query: data => ({ url: CHECKOUT_ENDPOINTS.preview, method: 'POST', data }),
      transformResponse: mapCheckoutPreview,
      providesTags: [{ type: 'Checkout', id: 'CURRENT' }],
      keepUnusedDataFor: 30,
    }),
    getCheckoutSession: builder.query({
      query: sessionId => ({ url: CHECKOUT_ENDPOINTS.session(sessionId) }),
      transformResponse: mapCheckoutSession,
      providesTags: (_, __, sessionId) => [{ type: 'Checkout', id: sessionId }],
    }),
    updateCheckoutAddress: builder.mutation({
      query: ({ sessionId, addressId }) => ({
        url: CHECKOUT_ENDPOINTS.address(sessionId),
        method: 'PATCH',
        data: { addressId },
      }),
      transformResponse: mapCheckoutSession,
      invalidatesTags: (_, __, { sessionId }) => [{ type: 'Checkout', id: sessionId }],
    }),
    updateCheckoutPaymentMethod: builder.mutation({
      query: ({ sessionId, paymentMethod }) => ({
        url: CHECKOUT_ENDPOINTS.paymentMethod(sessionId),
        method: 'PATCH',
        data: { paymentMethod },
      }),
      transformResponse: mapCheckoutSession,
      invalidatesTags: (_, __, { sessionId }) => [{ type: 'Checkout', id: sessionId }],
    }),
    updateCheckoutWallet: builder.mutation({
      query: ({ sessionId, use }) => ({
        url: CHECKOUT_ENDPOINTS.wallet(sessionId),
        method: 'PUT',
        data: { use },
      }),
      transformResponse: mapCheckoutSession,
      invalidatesTags: (_, __, { sessionId }) => [{ type: 'Checkout', id: sessionId }],
    }),
    revalidateCheckoutSession: builder.mutation({
      query: sessionId => ({ url: CHECKOUT_ENDPOINTS.revalidate(sessionId), method: 'POST' }),
      transformResponse: mapCheckoutSession,
      invalidatesTags: (_, __, sessionId) => [{ type: 'Checkout', id: sessionId }],
    }),
  }),
});

export const {
  useCreateCheckoutSessionMutation,
  useGetCheckoutPreviewQuery,
  useGetCheckoutSessionQuery,
  useRevalidateCheckoutSessionMutation,
  useUpdateCheckoutAddressMutation,
  useUpdateCheckoutPaymentMethodMutation,
  useUpdateCheckoutWalletMutation,
} = checkoutApi;
