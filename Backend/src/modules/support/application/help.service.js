import { NotFoundError } from '../../../shared/errors/AppError.js';
import { HELP_CATEGORIES } from '../domain/constants/helpContent.js';
import { HelpFeedback } from '../infrastructure/persistence/helpFeedback.model.js';

// The Help Center: read-only articles (domain/constants/helpContent.js) plus each customer's own helpful / not helpful answer.

const ARTICLES = new Map(HELP_CATEGORIES.flatMap((category) => category.articles).map((article) => [article.id, article]));
const withoutBody = ({ body, ...article }) => article;
const MIN_SEARCH_LENGTH = 2;

export const listHelpCategories = () => ({
  items: HELP_CATEGORIES.map((category) => ({ ...category, articles: category.articles.map(withoutBody) })),
});

export function getHelpCategory(id) {
  const category = HELP_CATEGORIES.find((item) => item.id === id);
  if (!category) throw new NotFoundError('This help category was not found.');
  return { ...category, articles: category.articles.map(withoutBody) };
}

export async function getHelpArticle(id, viewerId = null) {
  const article = ARTICLES.get(id);
  if (!article) throw new NotFoundError('This help article was not found.');
  const vote = viewerId ? await HelpFeedback.findOne({ customerId: String(viewerId), articleId: id }, 'helpful').lean() : null;
  return { ...article, viewerFeedback: vote ? (vote.helpful ? 'HELPFUL' : 'NOT_HELPFUL') : null };
}

export function searchHelp(query) {
  const text = String(query ?? '').trim().toLowerCase();
  const items = text.length < MIN_SEARCH_LENGTH ? [] : [...ARTICLES.values()].filter((article) => `${article.title} ${article.summary} ${article.body}`.toLowerCase().includes(text));
  return { items: items.map(withoutBody), query: text, total: items.length };
}

export async function setHelpFeedback(customerId, id, helpful) {
  if (!ARTICLES.has(id)) throw new NotFoundError('This help article was not found.');
  await HelpFeedback.updateOne({ customerId: String(customerId), articleId: id }, { $set: { helpful } }, { upsert: true });
  return getHelpArticle(id, customerId);
}
