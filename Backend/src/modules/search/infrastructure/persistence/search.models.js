import mongoose from 'mongoose';

const DAY_SECONDS = 86_400;

// How often each query was searched on each day (only queries that found something). No customer is recorded, so nothing here is personal.
// Trending = the most searched queries over the last week; a day's row is forgotten after two weeks.
const statSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // the query, lower-cased and tidied
    text: { type: String, required: true }, // how it was first typed that day
    day: { type: String, required: true }, // UTC YYYY-MM-DD
    count: { type: Number, default: 0 },
    expireAt: { type: Date, required: true },
  },
  { collection: 'search_query_stats', versionKey: false },
);
statSchema.index({ key: 1, day: 1 }, { unique: true });
statSchema.index({ day: 1 });
statSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

// Who already counted a query today, so one person repeating a search (or a script) moves trending once. `who` is a customer id or a
// network address; the row is forgotten after a day.
const seenSchema = new mongoose.Schema(
  { slot: { type: String, required: true, unique: true }, expireAt: { type: Date, required: true } },
  { collection: 'search_query_seen', versionKey: false },
);
seenSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

// One customer's recent searches, newest first (a repeat moves to the top). Kept 90 days, at most 20 per customer.
const historySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    key: { type: String, required: true },
    text: { type: String, required: true },
    searchedAt: { type: Date, default: Date.now },
  },
  { collection: 'search_history', versionKey: false },
);
historySchema.index({ userId: 1, key: 1 }, { unique: true });
historySchema.index({ userId: 1, searchedAt: -1 });
historySchema.index({ searchedAt: 1 }, { expireAfterSeconds: 90 * DAY_SECONDS });

export const SearchQueryStat = mongoose.models.SearchQueryStat ?? mongoose.model('SearchQueryStat', statSchema);
export const SearchQuerySeen = mongoose.models.SearchQuerySeen ?? mongoose.model('SearchQuerySeen', seenSchema);
export const SearchHistory = mongoose.models.SearchHistory ?? mongoose.model('SearchHistory', historySchema);
