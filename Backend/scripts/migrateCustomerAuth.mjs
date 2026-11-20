import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { User } from '../src/modules/identity/infrastructure/persistence/user.model.js';

await connectDatabase();
try {
  const indexes = await User.collection.indexes();
  if (!indexes.some((index) => index.name === 'email_role_unique_when_present')) {
    await User.collection.createIndex(
      { email: 1, role: 1 },
      {
        unique: true,
        partialFilterExpression: { email: { $type: 'string' } },
        name: 'email_role_unique_when_present',
      },
    );
  }
  if (indexes.some((index) => index.name === 'email_1_role_1')) {
    await User.collection.dropIndex('email_1_role_1');
  }
  if (!indexes.some((index) => index.name === 'phone_role_unique_when_present')) {
    await User.collection.createIndex(
      { phone: 1, role: 1 },
      {
        unique: true,
        partialFilterExpression: { phone: { $type: 'string' } },
        name: 'phone_role_unique_when_present',
      },
    );
  }
  if (indexes.some((index) => index.name === 'phone_1')) {
    await User.collection.dropIndex('phone_1');
  }
  console.log('Customer auth indexes are ready.');
} finally {
  await disconnectDatabase();
}
