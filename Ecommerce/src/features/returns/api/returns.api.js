import { baseApi } from '@core/api/baseApi';
import { RETURN_ENDPOINTS } from './returns.endpoints';
import { mapReturnEligibility, mapReturnRequest } from './returns.mapper';

export const returnsApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getReturnEligibility: builder.query({
      query: orderId => ({ url: RETURN_ENDPOINTS.eligibility(orderId) }),
      transformResponse: mapReturnEligibility,
      providesTags: (_, __, orderId) => [{ type: 'Return', id: `ELIGIBILITY-${orderId}` }],
    }),
    createReturn: builder.mutation({
      query: data => ({ url: RETURN_ENDPOINTS.create, method: 'POST', data }),
      transformResponse: mapReturnRequest,
      invalidatesTags: (_, __, { orderId }) => [
        { type: 'Return', id: `ELIGIBILITY-${orderId}` },
        { type: 'Order', id: orderId },
        { type: 'Order', id: 'LIST' },
      ],
    }),
    getReturn: builder.query({
      query: returnId => ({ url: RETURN_ENDPOINTS.detail(returnId) }),
      transformResponse: mapReturnRequest,
      providesTags: (_, __, returnId) => [{ type: 'Return', id: returnId }],
    }),
    cancelReturn: builder.mutation({
      query: returnId => ({ url: RETURN_ENDPOINTS.cancel(returnId), method: 'POST' }),
      transformResponse: mapReturnRequest,
      invalidatesTags: (_, __, returnId) => [{ type: 'Return', id: returnId }],
    }),
  }),
});
export const {
  useCancelReturnMutation,
  useCreateReturnMutation,
  useGetReturnEligibilityQuery,
  useGetReturnQuery,
} = returnsApi;
