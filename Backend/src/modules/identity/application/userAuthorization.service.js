import { User } from '../infrastructure/persistence/user.model.js';

/** Public identity facade used by feature modules that enforce fine-grained admin scope (and show who made a change). */
export async function getUserAuthorization(userId) {
  return User.findById(userId, 'permissions scope name').lean();
}
