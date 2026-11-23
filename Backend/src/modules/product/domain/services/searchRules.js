// Product search rules: how a typed query is split, which products match it, and how well. Pure.

const MAX_TOKENS = 6;
const MAX_TOKEN_LENGTH = 40;
const IN_STOCK_BONUS = 12; // big enough that a sold-out item sinks below a reasonable in-stock match, small enough that an exact name still wins

/** "  Nike   running shoes " -> ['nike', 'running', 'shoes']. Every word must match, in any order. */
export function tokenize(query) {
  const words = String(query ?? '').normalize('NFKC').toLowerCase().split(/\s+/).filter(Boolean);
  return [...new Set(words.map((word) => word.slice(0, MAX_TOKEN_LENGTH)))].slice(0, MAX_TOKENS);
}

// A card carries its leaf and root category names; the full category path adds the levels in between, which only the database filter sees.
const haystack = (card) => `${card.name} ${card.brand} ${card.category} ${card.rootCategory ?? ''}`.toLowerCase();

/** Whether every token appears in the product's name, brand or category. */
export const cardMatches = (card, tokens) => {
  const text = haystack(card);
  return tokens.every((token) => text.includes(token));
};

const startsAWord = (text, token) => text.startsWith(token) || text.includes(` ${token}`);

/**
 * How well a card answers the query (higher is better): the name matching as a phrase or word-start counts most, then the
 * brand, then the category; something you can buy now beats something sold out.
 */
export function relevanceScore(card, tokens) {
  const phrase = tokens.join(' ');
  const name = card.name.toLowerCase();
  const brand = (card.brand ?? '').toLowerCase();
  const category = `${card.category} ${card.rootCategory ?? ''}`.toLowerCase();
  let score = card.inStock ? IN_STOCK_BONUS : 0;
  if (tokens.length) {
    if (name === phrase) score += 40;
    else if (name.startsWith(phrase)) score += 15;
    else if (name.includes(phrase)) score += 8;
    if (brand === phrase) score += 20;
  }
  for (const token of tokens) {
    if (startsAWord(name, token)) score += 8;
    else if (name.includes(token)) score += 4;
    if (brand.startsWith(token)) score += 7;
    else if (brand.includes(token)) score += 5;
    if (category.includes(token)) score += 2;
  }
  return score;
}

/** Cards best-first. Ties keep their incoming order (newest first), then the better rated one wins. */
export function rankByRelevance(cards, tokens) {
  const scored = cards.map((card, index) => ({ card, index, score: relevanceScore(card, tokens) }));
  scored.sort((a, b) => b.score - a.score || (b.card.ratingCount ?? 0) - (a.card.ratingCount ?? 0) || a.index - b.index);
  return scored.map((entry) => entry.card);
}

/** Cards by units sold (`sales`: Map productId -> units), best seller first; ties fall back to relevance. */
export function rankByPopularity(cards, tokens, sales) {
  return rankByRelevance(cards, tokens)
    .map((card, index) => ({ card, index, units: sales.get(card.id) ?? 0 }))
    .sort((a, b) => b.units - a.units || a.index - b.index)
    .map((entry) => entry.card);
}
