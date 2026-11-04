import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './baseQuery';

export const API_TAGS = [
  'Session',
  'Profile',
  'Address',
  'Home',
  'Category',
  'Brand',
  'Product',
  'Search',
  'Cart',
  'Checkout',
  'Order',
  'Return',
  'Refund',
  'Shipment',
  'Wishlist',
  'Wallet',
  'Coupon',
  'Notification',
  'Review',
  'Question',
  'Ticket',
  'StaticContent',
  'FeatureFlag',
];

export const baseApi = createApi({
  reducerPath: 'customerApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: API_TAGS,
  endpoints: () => ({}),
  refetchOnFocus: true,
  refetchOnReconnect: true,
});
