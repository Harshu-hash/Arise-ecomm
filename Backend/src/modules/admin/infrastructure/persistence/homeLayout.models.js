import mongoose from 'mongoose';
import { HOME_SECTION_TYPES, HOME_SLOT } from '../../domain/constants/cms.js';

const sectionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: HOME_SECTION_TYPES, required: true },
    campaignId: { type: String, default: undefined }, // flash-sale / deal rows: the campaign this row places
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    visibility: { enabled: { type: Boolean, default: true } },
  },
  { _id: false },
);

// One version of the home layout. `slot` is DRAFT or PUBLISHED for the current ones and absent once archived,
// so the status needs no second field to keep in sync.
const versionSchema = new mongoose.Schema(
  {
    slot: { type: String, enum: Object.values(HOME_SLOT), default: undefined },
    sections: { type: [sectionSchema], default: [] },
    note: { type: String, default: null },
    createdBy: { type: String, required: true },
    createdByName: { type: String, default: null },
    publishedBy: { type: String, default: null },
    publishedByName: { type: String, default: null },
    publishedAt: { type: Date, default: null },
    // Maker-checker: a rollback to this (archived) version waits here until a different admin approves it.
    rollbackRequest: {
      type: new mongoose.Schema(
        { reason: String, requestedBy: String, requestedByName: String, requestedAt: Date },
        { _id: false },
      ),
      default: null,
    },
  },
  { collection: 'homeLayoutVersions', timestamps: true, versionKey: false },
);

// The database itself guarantees a single draft and a single published layout, even under concurrent publishes.
versionSchema.index({ slot: 1 }, { unique: true, partialFilterExpression: { slot: { $type: 'string' } }, name: 'one_per_slot' });
versionSchema.index({ createdAt: -1 });

export const HomeLayoutVersion = mongoose.models.HomeLayoutVersion ?? mongoose.model('HomeLayoutVersion', versionSchema);

// One tab per customer-visible root category; the console overrides how it looks and whether it shows.
const categoryTabSchema = new mongoose.Schema(
  {
    categoryId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, immutable: true },
    label: { type: String, required: true },
    icon: { type: String, default: 'grid' },
    gradient: { type: [String], default: undefined },
    layoutVariant: { type: String, default: 'DEFAULT' },
    active: { type: Boolean, default: true },
    order: { type: Number, required: true },
  },
  { collection: 'homeCategoryTabs', timestamps: true, versionKey: false },
);
categoryTabSchema.index({ order: 1 });

export const CategoryTab = mongoose.models.CategoryTab ?? mongoose.model('CategoryTab', categoryTabSchema);

const brandTabSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, immutable: true },
    label: { type: String, required: true },
    logo: { type: String, default: null },
    target: { type: String, default: null },
    active: { type: Boolean, default: true },
    order: { type: Number, required: true },
  },
  { collection: 'homeBrandTabs', timestamps: true, versionKey: false },
);

export const BrandTab = mongoose.models.BrandTab ?? mongoose.model('BrandTab', brandTabSchema);
