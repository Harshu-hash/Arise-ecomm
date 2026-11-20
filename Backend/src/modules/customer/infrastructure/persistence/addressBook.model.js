import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, enum: ['Home', 'Work', 'Other'], required: true },
    isDefault: { type: Boolean, required: true, default: false },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    line: { type: String, required: true, trim: true, maxlength: 300 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    state: { type: String, required: true, trim: true, maxlength: 100 },
    pincode: { type: String, required: true, trim: true, maxlength: 6 },
  },
  { timestamps: true, versionKey: false },
);

const addressBookSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, immutable: true },
    addresses: { type: [addressSchema], default: [] },
  },
  { collection: 'customer_address_books', timestamps: true, optimisticConcurrency: true },
);

export const AddressBook =
  mongoose.models.CustomerAddressBook ?? mongoose.model('CustomerAddressBook', addressBookSchema);
