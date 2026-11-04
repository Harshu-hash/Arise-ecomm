import { sellerLeadResponseSchema } from './seller.schemas';

export const mapSellerLead = payload => sellerLeadResponseSchema.parse(payload).data;
