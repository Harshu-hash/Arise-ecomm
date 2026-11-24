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

/* ---------------------------------------------------------------- synonyms and spelling */

// shortcut: a small hand-kept list, not a thesaurus; grow it from what customers search and miss.
const SYNONYM_GROUPS = [
  ['tshirt', 't-shirt', 'tee'], ['sneakers', 'shoes', 'trainers'], ['mobile', 'phone', 'smartphone'],
  ['laptop', 'notebook'], ['tv', 'television'], ['kurta', 'kurti'], ['jeans', 'denim'], ['earphones', 'headphones', 'earbuds'],
];
const SYNONYMS = new Map(SYNONYM_GROUPS.flatMap((group) => group.map((word) => [word, group])));

/** A word and the words that mean the same ("tee" -> tee, tshirt, t-shirt). */
export const withSynonyms = (token) => SYNONYMS.get(token) ?? [token];

/** Whether every token, or a synonym of it, appears in the card's name, brand or category. */
export const cardMatchesLoosely = (card, tokens) => {
  const text = haystack(card);
  return tokens.every((token) => withSynonyms(token).some((word) => text.includes(word)));
};

/** Edit distance where swapping two neighbouring letters is one slip ("nkie" -> "nike"); returns max + 1 when it must exceed `max`. */
export function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i += 1) {
    rows[i] = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

/**
 * "Did you mean": each word nobody sells is swapped for the closest word on the shelf (one slip for short words, two for
 * long ones; `vocabulary` is a Map word -> how many products carry it). Returns the corrected tokens, or null when nothing
 * needed or could be fixed.
 */
export function correctTokens(tokens, vocabulary) {
  let changed = false;
  const fixed = tokens.map((token) => {
    if (vocabulary.has(token) || token.length < 4 || withSynonyms(token).some((word) => vocabulary.has(word))) return token;
    const max = token.length > 6 ? 2 : 1;
    let best = null;
    for (const [word, weight] of vocabulary) {
      const distance = editDistance(token, word, max);
      if (distance <= max && (!best || distance < best.distance || (distance === best.distance && weight > best.weight))) best = { word, distance, weight };
    }
    if (!best) return token;
    changed = true;
    return best.word;
  });
  return changed ? fixed : null;
}

/** Every word in the cards' names, brands and categories, with how many cards carry it. */
export function vocabularyOf(cards) {
  const vocabulary = new Map();
  for (const card of cards) {
    for (const word of new Set(haystack(card).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3))) vocabulary.set(word, (vocabulary.get(word) ?? 0) + 1);
  }
  return vocabulary;
}
