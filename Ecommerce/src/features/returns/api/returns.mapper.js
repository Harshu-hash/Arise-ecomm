import { returnEligibilityResponseSchema, returnResponseSchema } from './returns.schemas';

export const mapReturnEligibility = payload => returnEligibilityResponseSchema.parse(payload).data;
export const mapReturnRequest = payload => {
  const request = returnResponseSchema.parse(payload).data;
  return { ...request, refund: { ...request.refund, amount: request.refund.amountPaise / 100 } };
};
