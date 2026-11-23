import { baseApi } from '@core/api/baseApi';
import { RETURN_ENDPOINTS } from './returns.endpoints';
import { mapReturnEligibility, mapReturnList, mapReturnRequest } from './returns.mapper';

export const returnsApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getReturnEligibility: builder.query({
      query: orderId => ({ url: RETURN_ENDPOINTS.eligibility(orderId) }),
      transformResponse: mapReturnEligibility,
      providesTags: (_, __, orderId) => [{ type: 'Return', id: `ELIGIBILITY-${orderId}` }],
    }),
    getReturns: builder.query({
      query: () => ({ url: RETURN_ENDPOINTS.list }),
      transformResponse: mapReturnList,
      providesTags: [{ type: 'Return', id: 'LIST' }],
    }),
    createReturn: builder.mutation({
      query: data => ({ url: RETURN_ENDPOINTS.create, method: 'POST', data }),
      transformResponse: mapReturnRequest,
      invalidatesTags: (_, __, { orderId }) => [
        { type: 'Return', id: `ELIGIBILITY-${orderId}` },
        { type: 'Return', id: 'LIST' },
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
      invalidatesTags: (result, __, returnId) => [
        { type: 'Return', id: returnId },
        { type: 'Return', id: 'LIST' },
        { type: 'Order', id: 'LIST' },
        ...(result ? [{ type: 'Order', id: result.orderId }, { type: 'Return', id: `ELIGIBILITY-${result.orderId}` }] : []),
      ],
    }),
  }),
});
export const {
  useCancelReturnMutation,
  useCreateReturnMutation,
  useGetReturnEligibilityQuery,
  useGetReturnQuery,
  useGetReturnsQuery,
} = returnsApi;
