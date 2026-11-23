import { logger } from '../../../config/logger.js';
import { ttlMemo } from '../../../shared/utils/ttlMemo.js';
import { getCatalogHighlights, suggestFromCatalog } from '../../product/public/index.js';
import { cleanQuery } from '../domain/services/searchQueryRules.js';
import { SearchHistory, SearchQueryStat } from '../infrastructure/persistence/search.models.js';

const DAY_MS = 86_400_000;
const TRENDING_DAYS = 7;
const TRENDING_LIMIT = 8;
const MIN_SEARCHES_TO_TREND = 2; // one stray search is not a trend
const HISTORY_LIMIT = 20;
const RECENT_SHOWN = 8;

const dayOf = (date) => date.toISOString().slice(0, 10);

/** Counts a search that found something toward trending. Best effort: never slows or fails the search itself. */
export async function recordSearch(rawQuery, total) {
  const query = cleanQuery(rawQuery);
  if (!query || !(total > 0)) return;
  const now = new Date();
  try {
    await SearchQueryStat.updateOne(
      { key: query.key, day: dayOf(now) },
      { $inc: { count: 1 }, $setOnInsert: { text: query.text, expireAt: new Date(now.getTime() + 14 * DAY_MS) } },
      { upsert: true },
    );
  } catch (err) {
    logger.warn({ err }, 'Could not record a search');
  }
}

/** The most searched queries of the past week, topped up with the shelf's biggest brands and departments while few people have searched. */
const trending = ttlMemo(async () => {
  const since = dayOf(new Date(Date.now() - (TRENDING_DAYS - 1) * DAY_MS));
  const rows = await SearchQueryStat.aggregate([
    { $match: { day: { $gte: since } } },
    { $group: { _id: '$key', text: { $first: '$text' }, count: { $sum: '$count' } } },
    { $match: { count: { $gte: MIN_SEARCHES_TO_TREND } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: TRENDING_LIMIT },
  ]);
  const seen = new Set();
  return [...rows.map((row) => row.text), ...(rows.length < TRENDING_LIMIT ? await getCatalogHighlights(TRENDING_LIMIT) : [])]
    .filter((text) => !seen.has(text.toLowerCase()) && seen.add(text.toLowerCase()))
    .slice(0, TRENDING_LIMIT);
}, 60_000, () => 'all');

/** What the search box shows: suggestions for what was typed, trending searches, and related searches to try. */
export async function getSuggestions(q) {
  const [{ suggestions, related }, trendingNow] = await Promise.all([suggestFromCatalog(q), trending()]);
  return { suggestions, trending: trendingNow, prompts: related };
}

export async function listRecentSearches(userId) {
  const rows = await SearchHistory.find({ userId: String(userId) }, 'text').sort({ searchedAt: -1 }).limit(RECENT_SHOWN).lean();
  return { items: rows.map((row) => row.text) };
}

/** Remembers a search for this customer (a repeat moves to the top) and forgets all but their newest 20. */
export async function addRecentSearch(userId, rawQuery) {
  const query = cleanQuery(rawQuery);
  if (query) {
    await SearchHistory.updateOne({ userId: String(userId), key: query.key }, { $set: { text: query.text, searchedAt: new Date() } }, { upsert: true });
    const stale = await SearchHistory.find({ userId: String(userId) }, '_id').sort({ searchedAt: -1 }).skip(HISTORY_LIMIT).lean();
    if (stale.length) await SearchHistory.deleteMany({ _id: { $in: stale.map((row) => row._id) } });
  }
  return listRecentSearches(userId);
}

/** Clears this customer's history; also what account deletion calls. */
export const clearRecentSearches = (userId) => SearchHistory.deleteMany({ userId: String(userId) });
