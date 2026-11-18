import mongoose from 'mongoose';

const attributeSetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    nameKey: { type: String, required: true, select: false },
    rootName: { type: String, trim: true, maxlength: 100, default: null },
    rootId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, select: false },
    attributeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attribute', required: true }],
    usedInCategories: { type: Number, min: 0, default: 0 },
    version: { type: Number, min: 1, default: 1 },
  },
  { collection: 'attributeSets', timestamps: true, versionKey: false },
);

attributeSetSchema.index({ nameKey: 1 }, { unique: true, name: 'attribute_set_name_unique' });
attributeSetSchema.index({ rootName: 1, name: 1 });
attributeSetSchema.index({ rootId: 1 });

export const AttributeSet = mongoose.models.AttributeSet ?? mongoose.model('AttributeSet', attributeSetSchema);
