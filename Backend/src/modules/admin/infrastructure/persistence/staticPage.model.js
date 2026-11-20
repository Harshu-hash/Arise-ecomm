import mongoose from 'mongoose';
import { PAGE_STATUS } from '../../domain/constants/cms.js';

const versionSchema = new mongoose.Schema(
  { body: String, editedBy: String, editedByName: String, editedAt: Date, note: { type: String, default: null } },
  { _id: false },
);

const staticPageSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, immutable: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    status: { type: String, enum: Object.values(PAGE_STATUS), default: PAGE_STATUS.DRAFT },
    // shortcut: reflects the latest publish only; per-customer acceptance tracking arrives with the customer app's consent flow.
    requiresReacceptance: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    versions: { type: [versionSchema], default: [] },
  },
  { collection: 'staticPages', timestamps: true, versionKey: false },
);

export const StaticPage = mongoose.models.StaticPage ?? mongoose.model('StaticPage', staticPageSchema);
