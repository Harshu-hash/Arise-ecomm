import { returnEligibilityResponseSchema, returnListResponseSchema, returnResponseSchema } from './returns.schemas';

export const mapReturnEligibility = payload => returnEligibilityResponseSchema.parse(payload).data;
const withRupees = request => ({ ...request, refund: { ...request.refund, amount: request.refund.amountPaise / 100 } });
export const mapReturnRequest = payload => withRupees(returnResponseSchema.parse(payload).data);
export const mapReturnList = payload => {
  const { items, nextCursor } = returnListResponseSchema.parse(payload).data;
  return { items: items.map(withRupees), nextCursor };
};
