import { baseApi } from '@core/api/baseApi';
import { CHECKOUT_ENDPOINTS } from './checkout.endpoints';
import { mapCheckoutSession } from './checkout.mapper';

export const checkoutApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    createCheckoutSession: builder.mutation({
      query: ({ idempotencyKey, ...data }) => ({
        url: CHECKOUT_ENDPOINTS.sessions,
        method: 'POST',
        data,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      transformResponse: mapCheckoutSession,
      invalidatesTags: [{ type: 'Checkout', id: 'CURRENT' }],
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
    revalidateCheckoutSession: builder.mutation({
      query: sessionId => ({ url: CHECKOUT_ENDPOINTS.revalidate(sessionId), method: 'POST' }),
      transformResponse: mapCheckoutSession,
      invalidatesTags: (_, __, sessionId) => [{ type: 'Checkout', id: sessionId }],
    }),
  }),
});

export const {
  useCreateCheckoutSessionMutation,
  useGetCheckoutSessionQuery,
  useRevalidateCheckoutSessionMutation,
  useUpdateCheckoutAddressMutation,
  useUpdateCheckoutPaymentMethodMutation,
} = checkoutApi;
