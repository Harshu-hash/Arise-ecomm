import { baseApi } from '@core/api/baseApi';
import { SELLER_ENDPOINTS } from './seller.endpoints';
import { mapSellerLead } from './seller.mapper';
import { sellerLeadInputSchema } from './seller.schemas';

export const sellerApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    submitSellerLead: builder.mutation({
      query: input => ({
        url: SELLER_ENDPOINTS.leads,
        method: 'POST',
        data: sellerLeadInputSchema.parse(input),
        headers: { 'Idempotency-Key': input.idempotencyKey },
      }),
      transformResponse: mapSellerLead,
    }),
  }),
});

export const { useSubmitSellerLeadMutation } = sellerApi;
