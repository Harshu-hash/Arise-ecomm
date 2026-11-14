// One-off bootstrap: creates (or resets) a super_admin account so there is a way to log
// into the admin console before any invite flow has been used.
// Usage: node scripts/seedAdmin.mjs [email] [password]
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { hashPassword } from '../src/shared/utils/crypto.js';
import { User } from '../src/modules/identity/infrastructure/persistence/user.model.js';
import { seedRoles } from '../src/modules/identity/infrastructure/persistence/role.model.js';

const email = (process.argv[2] ?? 'admin@arise.test').toLowerCase();
const password = process.argv[3] ?? randomBytes(9).toString('base64url');

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  await seedRoles();
  // One-time fixup: older runs stored a literal `phone: null`, which defeats the sparse
  // unique index (a stored null still collides). Unset it so the field is genuinely absent.
  await User.updateMany({ phone: null }, { $unset: { phone: '' } });

  const passwordHash = await hashPassword(password);
  let user = await User.findOne({ role: 'ADMIN', email });
  const existed = Boolean(user);
  if (user) {
    user.passwordHash = passwordHash;
    user.status = 'ACTIVE';
    user.permissions = ['*'];
    user.mustChangePassword = false;
    await user.save();
  } else {
    user = await User.create({
      role: 'ADMIN', email, name: 'Super Admin', passwordHash, status: 'ACTIVE', permissions: ['*'],
    });
  }

  console.log(existed ? 'Admin account updated:' : 'Admin account created:');
  console.log('  email:   ', email);
  console.log('  password:', password);
  console.log('  role:     super_admin (permissions: *)');

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
