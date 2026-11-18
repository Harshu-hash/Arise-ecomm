import mongoose from 'mongoose';
import { CROP_ASPECTS } from '../../domain/services/mediaRules.js';

// A presign/upload/complete session and its resulting file, as one record. `key` stays
// null until bytes actually land; `expiresAt` sweeps up sessions nobody ever finished.
const mediaSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, index: true },
    kind: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'READY', 'FAILED'], default: 'PENDING' },
    key: { type: String, default: null },
    mime: { type: String, default: null },
    sizeBytes: { type: Number, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    fileName: { type: String, trim: true, maxlength: 255, default: null },
    crop: {
      aspect: { type: String, enum: CROP_ASPECTS, default: 'original' },
    },
    processingError: { type: String, default: null },
    version: { type: Number, min: 1, default: 1 },
  },
  { collection: 'media', timestamps: true, versionKey: false },
);

mediaSchema.index({ ownerId: 1, createdAt: -1 });
// A PENDING record whose bytes never arrived is abandoned after a day.
mediaSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86_400, partialFilterExpression: { status: 'PENDING' } });

export const Media = mongoose.models.Media ?? mongoose.model('Media', mediaSchema);
