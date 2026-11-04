import { baseApi } from '@core/api/baseApi';
import { mapGiftCard, mapReferral, mapTransactions, mapWallet } from './wallet.mapper';
export const walletApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getWallet: builder.query({
      query: () => ({ url: '/wallet' }),
      transformResponse: mapWallet,
      providesTags: [{ type: 'Wallet', id: 'SUMMARY' }],
    }),
    getWalletTransactions: builder.query({
      query: ({ cursor, limit = 20 } = {}) => ({
        url: '/wallet/transactions',
        params: { cursor, limit },
      }),
      transformResponse: mapTransactions,
      providesTags: [{ type: 'Wallet', id: 'TRANSACTIONS' }],
    }),
    redeemGiftCard: builder.mutation({
      query: data => ({ url: '/gift-cards/redeem', method: 'POST', data }),
      transformResponse: mapGiftCard,
      invalidatesTags: [
        { type: 'Wallet', id: 'SUMMARY' },
        { type: 'Wallet', id: 'TRANSACTIONS' },
      ],
    }),
    getReferral: builder.query({
      query: () => ({ url: '/referrals/me' }),
      transformResponse: mapReferral,
      providesTags: [{ type: 'Profile', id: 'REFERRAL' }],
    }),
  }),
});
export const {
  useGetWalletQuery,
  useGetWalletTransactionsQuery,
  useRedeemGiftCardMutation,
  useGetReferralQuery,
} = walletApi;
