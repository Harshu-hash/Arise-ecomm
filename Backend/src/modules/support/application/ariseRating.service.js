import { getUserSummaries } from '../../identity/public/index.js';
import { AriseRating } from '../infrastructure/persistence/ariseRating.model.js';

const SORT_FIELDS = { rating: 'rating', ratedAt: 'ratedAt' };

export async function rateArise(customerId, rating, now = new Date()) {
  const row = await AriseRating.findOneAndUpdate(
    { customerId },
    { $set: { rating, ratedAt: now }, $setOnInsert: { customerId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return { id: String(row._id), rating: row.rating, ratedAt: row.ratedAt.toISOString() };
}

export async function listAriseRatings({ page, pageSize, rating, sort }) {
  const match = rating ? { rating } : {};
  const requestedField = sort.replace(/^-/, '');
  const sortField = SORT_FIELDS[requestedField] ?? 'ratedAt';
  const descending = SORT_FIELDS[requestedField] ? sort.startsWith('-') : true;
  const [rows, total] = await Promise.all([
    AriseRating.find(match).sort({ [sortField]: descending ? -1 : 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    AriseRating.countDocuments(match),
  ]);
  const customers = await getUserSummaries(rows.map((row) => row.customerId));
  return {
    rows: rows.map((row) => ({
      id: String(row._id),
      customerId: String(row.customerId),
      customerName: customers.get(String(row.customerId))?.name ?? 'Customer',
      rating: row.rating,
      ratedAt: row.ratedAt.toISOString(),
    })),
    total,
  };
}
