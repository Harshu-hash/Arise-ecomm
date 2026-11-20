import { ROLES } from '../../../shared/constants/roles.js';
import { ConflictError, NotFoundError } from '../../../shared/errors/AppError.js';
import { AuthChallenge } from '../infrastructure/persistence/authChallenge.model.js';
import { AuthSession } from '../infrastructure/persistence/session.model.js';
import { User } from '../infrastructure/persistence/user.model.js';

export async function assertActiveCustomer(userId) {
  const user = await User.findOne({ _id: userId, role: ROLES.CUSTOMER }, 'status').lean();
  if (!user) throw new NotFoundError('Your account could not be found.');
  if (user.status !== 'ACTIVE') {
    throw new ConflictError('ACCOUNT_NOT_ACTIVE', 'This account is not eligible for self-service deletion.');
  }
}

export async function anonymizeCustomerIdentity(userId) {
  const customer = await User.findOne({ _id: userId, role: ROLES.CUSTOMER }, 'status').lean();
  await Promise.all([
    AuthSession.updateMany(
      { userId: String(userId), revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'account_deleted' } },
    ),
    AuthChallenge.deleteMany({ userId: String(userId) }),
  ]);
  if (!customer || customer.status === 'DEACTIVATED') return;
  await User.updateOne(
    { _id: userId, role: ROLES.CUSTOMER },
    {
      $set: {
        name: 'Deleted customer',
        passwordHash: null,
        status: 'DEACTIVATED',
        lastLoginAt: null,
        twoFactor: { enrolled: false, secret: null, backupCodes: [] },
      },
      $unset: { email: '', phone: '', gender: '', avatarKey: '' },
    },
  );
}
