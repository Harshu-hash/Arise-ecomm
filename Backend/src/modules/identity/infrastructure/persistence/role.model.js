import mongoose from 'mongoose';
import { logger } from '../../../../config/logger.js';
import { SEEDED_ROLES } from '../../../../shared/rbac/roleTemplates.js';
import { User } from './user.model.js';

const roleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, immutable: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    system: { type: Boolean, default: false }, // system roles are seeded, not created by admins
    scopedBy: { type: [String], default: [] },
    permissions: { type: [String], required: true },
  },
  { collection: 'adminRoles', timestamps: true, versionKey: false },
);

export const Role = mongoose.models.Role ?? mongoose.model('Role', roleSchema);

const SUPER_ADMIN = SEEDED_ROLES.find((role) => role.key === 'super_admin');

// Idempotent. Only Super Admin is seeded (the bootstrap account needs it); every other role is
// created by admins. Older deployments also got the template roles seeded: those are retired
// here unless an admin still holds one.
export async function seedRoles() {
  await Role.updateOne({ key: SUPER_ADMIN.key }, { $set: SUPER_ADMIN }, { upsert: true });
  const held = await User.distinct('roleIds', { role: 'ADMIN' });
  const { deletedCount } = await Role.deleteMany({ system: true, key: { $ne: SUPER_ADMIN.key }, _id: { $nin: held } });
  logger.info({ retired: deletedCount }, 'Admin roles seeded');
}
