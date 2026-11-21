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

export { getSellerOwnerEmail, getSellerSummaries, getUserSummaries } from '../application/sellerLookup.service.js';

export { countCustomers, findCustomers, getCustomer } from '../application/customerLookup.service.js';
