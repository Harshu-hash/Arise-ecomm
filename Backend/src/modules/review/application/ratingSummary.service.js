import { averageOf, summaryChange } from '../domain/services/reviewRules.js';
import { ReviewSummary } from '../infrastructure/persistence/reviewSummary.model.js';

/** Moves a product's rating from what `before` contributed to what `after` contributes (each a review row or null). Atomic: concurrent changes add up. */
export async function applySummaryChange(productId, before, after) {
  const inc = summaryChange(before, after);
  if (inc) await ReviewSummary.updateOne({ productId: String(productId) }, { $inc: inc }, { upsert: true });
}

/** Map(productId -> { rating, ratingCount }) for the products that have at least one published review. */
export async function getRatingSummaries(productIds) {
  const rows = await ReviewSummary.find({ productId: { $in: productIds.map(String) }, count: { $gt: 0 } }).lean();
  return new Map(rows.map((row) => [row.productId, { rating: averageOf(row), ratingCount: row.count }]));
}

/** One product's rating with its star breakdown, for the reviews screen. */
export async function getRatingBreakdown(productId) {
  const row = await ReviewSummary.findOne({ productId: String(productId) }).lean();
  const count = row?.count ?? 0;
  return { average: (row && averageOf(row)) ?? 0, count, distribution: { 1: row?.s1 ?? 0, 2: row?.s2 ?? 0, 3: row?.s3 ?? 0, 4: row?.s4 ?? 0, 5: row?.s5 ?? 0 } };
}
