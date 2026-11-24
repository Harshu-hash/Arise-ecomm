// The only surface other modules may import from identity.
export {
  createSession,
  listSessions,
  revokeAllSessions,
  revokeSession,
  rotateSession,
} from '../application/session.service.js';

export { getUserAuthorization } from '../application/userAuthorization.service.js';

export {
  anonymizeCustomerIdentity,
  assertActiveCustomer,
} from '../application/customerDeletion.service.js';

export { getSellerOwnerEmail, getSellerPayoutProfiles, getSellerPickupProfile, setSellerPayoutHold, getSellerTaxProfile,getSellerSummaries, setSellerPickupLocationName, getUnsellableSellerIds, getUserSummaries, listActiveSellerIds } from '../application/sellerLookup.service.js';

export { countCustomers, findCustomers, listCustomerIds, getCustomer, getCustomerContact } from '../application/customerLookup.service.js';

// Read access for the analytics module (it aggregates; it never writes these).
export { Seller } from '../infrastructure/persistence/seller.model.js';
export { User } from '../infrastructure/persistence/user.model.js';
