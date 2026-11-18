import mongoose from 'mongoose';

// One document per settings section; a section with no document serves its defaults.
const platformSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, immutable: true },
    values: { type: mongoose.Schema.Types.Mixed, required: true },
    version: { type: Number, required: true }, // bumped with $inc on every save
    updatedBy: { type: String, default: null },
    updatedByName: { type: String, default: null },
  },
  { collection: 'platformSettings', timestamps: true, versionKey: false },
);

export const PlatformSetting = mongoose.models.PlatformSetting ?? mongoose.model('PlatformSetting', platformSettingSchema);
