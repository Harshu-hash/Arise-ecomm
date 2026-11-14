import mongoose from 'mongoose';
import { logger } from '../../../../config/logger.js';
import { SEEDED_ROLES } from '../../../../shared/rbac/roleTemplates.js';

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

// Idempotent: run at boot (and safe to call again any time the catalog changes) so the
// 15 reference roles always match shared/rbac/roleTemplates.js exactly.
export async function seedRoles() {
  await Promise.all(
    SEEDED_ROLES.map((role) =>
      Role.updateOne({ key: role.key }, { $set: role }, { upsert: true }),
    ),
  );
  logger.info({ count: SEEDED_ROLES.length }, 'Admin roles seeded');
}
