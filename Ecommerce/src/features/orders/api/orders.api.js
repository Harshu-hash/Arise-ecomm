import { baseApi } from '@core/api/baseApi';
import { ORDER_ENDPOINTS } from './orders.endpoints';
import { mapOrderResponse, mapOrders, mapTimeline } from './orders.mapper';

export const ordersApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getOrders: builder.query({
      query: args => ({ url: ORDER_ENDPOINTS.list, params: args }),
      transformResponse: mapOrders,
      providesTags: result => [
        { type: 'Order', id: 'LIST' },
        ...(result?.items ?? []).map(order => ({ type: 'Order', id: order.id })),
      ],
    }),
    getOrder: builder.query({
      query: orderId => ({ url: ORDER_ENDPOINTS.detail(orderId) }),
      transformResponse: mapOrderResponse,
      providesTags: (_, __, orderId) => [{ type: 'Order', id: orderId }],
    }),
    getOrderTimeline: builder.query({
      query: orderId => ({ url: ORDER_ENDPOINTS.timeline(orderId) }),
      transformResponse: mapTimeline,
      providesTags: (_, __, orderId) => [{ type: 'Shipment', id: orderId }],
    }),
    cancelOrder: builder.mutation({
      query: ({ orderId, reason, comment }) => ({
        url: ORDER_ENDPOINTS.cancel(orderId),
        method: 'POST',
        data: { reason, comment },
      }),
      transformResponse: mapOrderResponse,
      invalidatesTags: (_, __, { orderId }) => [
        { type: 'Order', id: orderId },
        { type: 'Order', id: 'LIST' },
        { type: 'Shipment', id: orderId },
      ],
    }),
  }),
});
export const {
  useCancelOrderMutation,
  useGetOrderQuery,
  useGetOrdersQuery,
  useGetOrderTimelineQuery,
} = ordersApi;
