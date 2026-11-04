import { baseApi } from '@core/api/baseApi';
import { PAYMENT_ENDPOINTS } from './payment.endpoints';
import {
  mapPayment,
  mapPaymentMethods,
  mapPaymentMethodSetup,
  mapPlacedOrder,
} from './payment.mapper';

export const paymentApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    createPaymentIntent: builder.mutation({
      query: ({ sessionId, method, idempotencyKey }) => ({
        url: PAYMENT_ENDPOINTS.intent(sessionId),
        method: 'POST',
        data: { method },
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      transformResponse: mapPayment,
    }),
    confirmPayment: builder.mutation({
      query: paymentId => ({ url: PAYMENT_ENDPOINTS.confirm(paymentId), method: 'POST' }),
      transformResponse: mapPayment,
    }),
    getPayment: builder.query({
      query: paymentId => ({ url: PAYMENT_ENDPOINTS.payment(paymentId) }),
      transformResponse: mapPayment,
    }),
    createOrder: builder.mutation({
      query: ({ checkoutSessionId, paymentId, idempotencyKey }) => ({
        url: PAYMENT_ENDPOINTS.orders,
        method: 'POST',
        data: { checkoutSessionId, paymentId },
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      transformResponse: mapPlacedOrder,
      invalidatesTags: [
        { type: 'Order', id: 'LIST' },
        { type: 'Cart', id: 'CURRENT' },
      ],
    }),
    getPaymentMethods: builder.query({
      query: () => ({ url: PAYMENT_ENDPOINTS.methods }),
      transformResponse: mapPaymentMethods,
      providesTags: [{ type: 'Profile', id: 'PAYMENT_METHODS' }],
    }),
    createPaymentMethodSetup: builder.mutation({
      query: ({ idempotencyKey, returnUrl }) => ({
        url: PAYMENT_ENDPOINTS.setupSession,
        method: 'POST',
        data: { returnUrl },
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      transformResponse: mapPaymentMethodSetup,
    }),
    deletePaymentMethod: builder.mutation({
      query: paymentMethodId => ({
        url: PAYMENT_ENDPOINTS.method(paymentMethodId),
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Profile', id: 'PAYMENT_METHODS' }],
    }),
  }),
});

export const {
  useCreatePaymentMethodSetupMutation,
  useConfirmPaymentMutation,
  useCreateOrderMutation,
  useCreatePaymentIntentMutation,
  useDeletePaymentMethodMutation,
  useGetPaymentQuery,
  useGetPaymentMethodsQuery,
  useLazyGetPaymentQuery,
} = paymentApi;
