import { baseApi } from '@core/api/baseApi';
import { FLASH_SALE_ENDPOINTS } from './flashSale.endpoints';
import { mapFlashSale } from './flashSale.mapper';

export const flashSaleApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getCurrentFlashSale: builder.query({
      query: () => ({ url: FLASH_SALE_ENDPOINTS.current }),
      transformResponse: mapFlashSale,
      providesTags: [{ type: 'Product', id: 'FLASH_SALE' }],
    }),
  }),
});
export const { useGetCurrentFlashSaleQuery } = flashSaleApi;
