import mongoose from 'mongoose';

const sizeChartSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    nameKey: { type: String, required: true, select: false },
    unit: { type: String, enum: ['in', 'cm'], required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    rootCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    columns: { type: [String], required: true },
    rows: { type: [[String]], required: true },
    productCount: { type: Number, min: 0, default: 0 },
    version: { type: Number, min: 1, default: 1 },
  },
  { collection: 'sizeCharts', timestamps: true, versionKey: false },
);

sizeChartSchema.index({ nameKey: 1 }, { unique: true, name: 'size_chart_name_unique' });
sizeChartSchema.index({ rootCategoryId: 1, name: 1, _id: 1 });

export const SizeChart = mongoose.models.SizeChart ?? mongoose.model('SizeChart', sizeChartSchema);
