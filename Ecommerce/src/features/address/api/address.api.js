import { baseApi } from '@core/api/baseApi';
import { ADDRESS_ENDPOINTS } from './address.endpoints';
import {
  mapAddresses,
  mapAddressResponse,
  mapAddressValidation,
  mapServiceability,
} from './address.mapper';

const invalidatesAddresses = (_, error) => (error ? [] : [{ type: 'Address', id: 'LIST' }]);
export const addressApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getAddresses: builder.query({
      query: () => ({ url: ADDRESS_ENDPOINTS.root }),
      transformResponse: mapAddresses,
      providesTags: result => [
        { type: 'Address', id: 'LIST' },
        ...(result?.items ?? []).map(address => ({ type: 'Address', id: address.id })),
      ],
    }),
    createAddress: builder.mutation({
      query: address => ({ url: ADDRESS_ENDPOINTS.root, method: 'POST', data: address }),
      transformResponse: mapAddressResponse,
      invalidatesTags: invalidatesAddresses,
    }),
    updateAddress: builder.mutation({
      query: ({ addressId, ...address }) => ({
        url: ADDRESS_ENDPOINTS.item(addressId),
        method: 'PATCH',
        data: address,
      }),
      transformResponse: mapAddressResponse,
      invalidatesTags: invalidatesAddresses,
    }),
    deleteAddress: builder.mutation({
      query: addressId => ({ url: ADDRESS_ENDPOINTS.item(addressId), method: 'DELETE' }),
      invalidatesTags: invalidatesAddresses,
    }),
    makeDefaultAddress: builder.mutation({
      query: addressId => ({ url: ADDRESS_ENDPOINTS.makeDefault(addressId), method: 'POST' }),
      transformResponse: mapAddressResponse,
      invalidatesTags: invalidatesAddresses,
    }),
    validateAddress: builder.mutation({
      query: address => ({ url: ADDRESS_ENDPOINTS.validate, method: 'POST', data: address }),
      transformResponse: mapAddressValidation,
    }),
    getServiceability: builder.query({
      query: pincode => ({ url: ADDRESS_ENDPOINTS.serviceability, params: { pincode } }),
      transformResponse: mapServiceability,
      keepUnusedDataFor: 300,
    }),
  }),
});

export const {
  useCreateAddressMutation,
  useDeleteAddressMutation,
  useGetAddressesQuery,
  useGetServiceabilityQuery,
  useMakeDefaultAddressMutation,
  useUpdateAddressMutation,
  useValidateAddressMutation,
} = addressApi;
