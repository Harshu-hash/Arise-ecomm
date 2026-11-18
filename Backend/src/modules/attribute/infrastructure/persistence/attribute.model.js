import mongoose from 'mongoose';
import { ATTRIBUTE_TYPES } from '../../domain/services/attributeRules.js';

const valueSchema = new mongoose.Schema(
  {
    value: { type: String, required: true, trim: true, maxlength: 100 },
    active: { type: Boolean, default: true },
    synonyms: [{ type: String, trim: true, maxlength: 100 }],
  },
  { _id: false },
);

const attributeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    code: { type: String, required: true, trim: true, lowercase: true, maxlength: 64 },
    type: { type: String, enum: ATTRIBUTE_TYPES, required: true },
    unit: { type: String, trim: true, maxlength: 32, default: null },
    filterable: { type: Boolean, default: false },
    variantDefining: { type: Boolean, default: false },
    values: { type: [valueSchema], default: [] },
    usedInCategories: { type: Number, min: 0, default: 0 },
    version: { type: Number, min: 1, default: 1 },
  },
  { collection: 'attributes', timestamps: true, versionKey: false },
);

attributeSchema.index({ code: 1 }, { unique: true, name: 'attribute_code_unique' });
attributeSchema.index({ name: 1, _id: 1 });

export const Attribute = mongoose.models.Attribute ?? mongoose.model('Attribute', attributeSchema);
