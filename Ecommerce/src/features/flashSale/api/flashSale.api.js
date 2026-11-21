import { baseApi } from '@core/api/baseApi';
import { FLASH_SALE_ENDPOINTS } from './flashSale.endpoints';
import { mapFlashSale } from './flashSale.mapper';

export const flashSaleApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getFlashSale: builder.query({
      query: campaignId => ({ url: FLASH_SALE_ENDPOINTS.byId(campaignId) }),
      transformResponse: mapFlashSale,
      providesTags: (_result, _error, campaignId) => [{ type: 'Product', id: `FLASH_SALE_${campaignId}` }],
    }),
  }),
});
export const { useGetFlashSaleQuery } = flashSaleApi;
