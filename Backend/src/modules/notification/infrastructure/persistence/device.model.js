import mongoose from 'mongoose';

// A phone that can receive pushes for one customer. The token is Firebase's; it is dropped (invalidAt) when Firebase says
// the app was uninstalled or the token rotated.
const deviceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, immutable: true },
    deviceId: { type: String, required: true, immutable: true },
    token: { type: String, required: true },
    platform: { type: String, enum: ['android', 'ios'], required: true },
    invalidAt: { type: Date, default: null },
  },
  { collection: 'push_devices', timestamps: true, versionKey: false },
);

deviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
deviceSchema.index({ token: 1 });

export const Device = mongoose.models.PushDevice ?? mongoose.model('PushDevice', deviceSchema);
