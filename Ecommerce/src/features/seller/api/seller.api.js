import { baseApi } from '@core/api/baseApi';
import { safeIdempotencyKey } from '@core/api/idempotency';
import { SELLER_ENDPOINTS } from './seller.endpoints';
import { mapSellerLead, mapSellerLeadStatus } from './seller.mapper';
import { sellerLeadInputSchema } from './seller.schemas';

export const sellerApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getSellerLead: builder.query({
      query: () => ({ url: SELLER_ENDPOINTS.myLead, method: 'GET' }),
      transformResponse: mapSellerLeadStatus,
      providesTags: ['SellerInquiry'],
    }),
    submitSellerLead: builder.mutation({
      query: input => ({
        url: SELLER_ENDPOINTS.leads,
        method: 'POST',
        data: sellerLeadInputSchema.parse(input),
        headers: { 'Idempotency-Key': safeIdempotencyKey(input.idempotencyKey) },
      }),
      transformResponse: mapSellerLead,
      invalidatesTags: ['SellerInquiry'],
    }),
  }),
});

export const { useGetSellerLeadQuery, useSubmitSellerLeadMutation } = sellerApi;
