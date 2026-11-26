import { sellerLeadResponseSchema, sellerLeadStatusResponseSchema } from './seller.schemas';

export const mapSellerLead = payload => sellerLeadResponseSchema.parse(payload).data;
export const mapSellerLeadStatus = payload => sellerLeadStatusResponseSchema.parse(payload).data;
