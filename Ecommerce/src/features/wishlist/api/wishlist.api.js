import { baseApi } from '@core/api/baseApi';
import { WISHLIST_ENDPOINTS } from './wishlist.endpoints';
import { mapWishlist, mapWishlistMove, mapWishlistMutation } from './wishlist.mapper';

const updateCachedWishlist = (dispatch, productId, updater) =>
  dispatch(
    wishlistApi.util.updateQueryData('getWishlist', undefined, draft => {
      updater(draft, productId);
      draft.total = draft.items.length;
    }),
  );

export const wishlistApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getWishlist: builder.query({
      query: () => ({ url: WISHLIST_ENDPOINTS.root }),
      transformResponse: mapWishlist,
      providesTags: result => [
        { type: 'Wishlist', id: 'LIST' },
        ...(result?.items ?? []).map(item => ({ type: 'Wishlist', id: item.id })),
      ],
    }),
    addWishlistItem: builder.mutation({
      query: productId => ({
        url: WISHLIST_ENDPOINTS.items,
        method: 'POST',
        data: { productId },
      }),
      transformResponse: mapWishlistMutation,
      invalidatesTags: (_, error) => (error ? [] : [{ type: 'Wishlist', id: 'LIST' }]),
    }),
    removeWishlistItem: builder.mutation({
      query: productId => ({ url: WISHLIST_ENDPOINTS.item(productId), method: 'DELETE' }),
      transformResponse: mapWishlistMutation,
      async onQueryStarted(productId, { dispatch, queryFulfilled }) {
        const patch = updateCachedWishlist(dispatch, productId, (draft, id) => {
          draft.items = draft.items.filter(item => item.id !== id);
        });
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_, error, productId) =>
        error ? [] : [{ type: 'Wishlist', id: productId }],
    }),
    moveWishlistItemToCart: builder.mutation({
      query: productId => ({ url: WISHLIST_ENDPOINTS.moveToCart(productId), method: 'POST' }),
      transformResponse: mapWishlistMove,
      async onQueryStarted(productId, { dispatch, queryFulfilled }) {
        const patch = updateCachedWishlist(dispatch, productId, (draft, id) => {
          draft.items = draft.items.filter(item => item.id !== id);
        });
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_, error) =>
        error
          ? []
          : [
              { type: 'Wishlist', id: 'LIST' },
              { type: 'Cart', id: 'CURRENT' },
            ],
    }),
  }),
});

export const {
  useGetWishlistQuery,
  useAddWishlistItemMutation,
  useRemoveWishlistItemMutation,
  useMoveWishlistItemToCartMutation,
} = wishlistApi;
