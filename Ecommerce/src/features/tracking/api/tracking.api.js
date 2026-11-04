import { baseApi } from '@core/api/baseApi';
import { TRACKING_ENDPOINTS } from './tracking.endpoints';
import { mapTracking } from './tracking.mapper';

export const trackingApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getShipmentTracking: builder.query({
      query: shipmentId => ({ url: TRACKING_ENDPOINTS.detail(shipmentId) }),
      transformResponse: mapTracking,
      providesTags: (_, __, shipmentId) => [{ type: 'Shipment', id: shipmentId }],
      keepUnusedDataFor: 15,
    }),
  }),
});
export const { useGetShipmentTrackingQuery } = trackingApi;
