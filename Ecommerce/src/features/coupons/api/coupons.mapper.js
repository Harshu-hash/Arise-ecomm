import { couponsResponseSchema } from './coupons.schemas';

export const mapCoupons = payload => {
  const value = couponsResponseSchema.parse(payload).data;
  return {
    ...value,
    items: value.items.map(item => ({
      ...item,
      subtitle: item.description,
      expiry: `Expires ${new Date(item.expiresAt).toLocaleDateString('en-IN')}`,
    })),
  };
};
