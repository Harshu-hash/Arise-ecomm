import { baseApi } from '@core/api/baseApi';
import { CART_ENDPOINTS } from './cart.endpoints';
import { mapCart, mapEligibleCoupons } from './cart.mapper';

const cartMutation = (builder, query) =>
  builder.mutation({
    query,
    transformResponse: mapCart,
    invalidatesTags: (_, error) =>
      error
        ? []
        : [
            { type: 'Cart', id: 'CURRENT' },
            { type: 'Coupon', id: 'ELIGIBLE' },
          ],
  });

export const cartApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getCart: builder.query({
      query: () => ({ url: CART_ENDPOINTS.root }),
      transformResponse: mapCart,
      providesTags: [{ type: 'Cart', id: 'CURRENT' }],
    }),
    addCartItem: cartMutation(builder, item => ({
      url: CART_ENDPOINTS.items,
      method: 'POST',
      data: item,
    })),
    updateCartItem: cartMutation(builder, ({ cartItemId, quantity }) => ({
      url: CART_ENDPOINTS.item(cartItemId),
      method: 'PATCH',
      data: { quantity },
    })),
    removeCartItem: cartMutation(builder, cartItemId => ({
      url: CART_ENDPOINTS.item(cartItemId),
      method: 'DELETE',
    })),
    saveCartItemForLater: cartMutation(builder, cartItemId => ({
      url: CART_ENDPOINTS.saveForLater(cartItemId),
      method: 'POST',
    })),
    moveSavedItemToCart: cartMutation(builder, cartItemId => ({
      url: CART_ENDPOINTS.moveToCart(cartItemId),
      method: 'POST',
    })),
    getEligibleCoupons: builder.query({
      query: cartId => ({ url: CART_ENDPOINTS.eligibleCoupons, params: { cartId } }),
      transformResponse: mapEligibleCoupons,
      providesTags: [{ type: 'Coupon', id: 'ELIGIBLE' }],
    }),
    applyCartCoupon: cartMutation(builder, code => ({
      url: CART_ENDPOINTS.coupon,
      method: 'POST',
      data: { code },
    })),
    removeCartCoupon: cartMutation(builder, () => ({
      url: CART_ENDPOINTS.coupon,
      method: 'DELETE',
    })),
  }),
});

export const {
  useAddCartItemMutation,
  useApplyCartCouponMutation,
  useGetCartQuery,
  useGetEligibleCouponsQuery,
  useMoveSavedItemToCartMutation,
  useRemoveCartCouponMutation,
  useRemoveCartItemMutation,
  useSaveCartItemForLaterMutation,
  useUpdateCartItemMutation,
} = cartApi;
