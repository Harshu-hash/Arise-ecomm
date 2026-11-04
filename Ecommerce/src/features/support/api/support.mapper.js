import {
  helpArticleResponseSchema,
  helpCategoriesResponseSchema,
  helpCategoryResponseSchema,
  helpSearchResponseSchema,
  subjectsResponseSchema,
  ticketResponseSchema,
  ticketsResponseSchema,
  supportChannelsResponseSchema,
} from './support.schemas';
export const mapSupportChannels = payload => supportChannelsResponseSchema.parse(payload).data;
const labels = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  WAITING_FOR_CUSTOMER: 'Waiting for You',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};
const mapTicket = ticket => ({
  ...ticket,
  statusLabel: labels[ticket.status],
  createdOn: new Date(ticket.createdAt).toLocaleString('en-IN'),
  updates: ticket.messages.map(message => ({
    ...message,
    author: message.authorDisplayName,
    text: message.body,
    date: new Date(message.createdAt).toLocaleString('en-IN'),
  })),
});
export const mapSubjects = payload => subjectsResponseSchema.parse(payload).data.items;
export const mapTickets = payload => {
  const data = ticketsResponseSchema.parse(payload).data;
  return { ...data, items: data.items.map(mapTicket) };
};
export const mapTicketResponse = payload => mapTicket(ticketResponseSchema.parse(payload).data);
const mapArticleSummary = article => ({
  ...article,
  question: article.title,
  answer: article.summary,
});
const mapCategory = category => ({
  ...category,
  articles: category.articles.map(mapArticleSummary),
});
export const mapHelpCategories = payload =>
  helpCategoriesResponseSchema.parse(payload).data.items.map(mapCategory);
export const mapHelpCategory = payload =>
  mapCategory(helpCategoryResponseSchema.parse(payload).data);
export const mapHelpArticle = payload => {
  const article = helpArticleResponseSchema.parse(payload).data;
  return { ...article, question: article.title, answer: article.body };
};
export const mapHelpSearch = payload => {
  const data = helpSearchResponseSchema.parse(payload).data;
  return { ...data, items: data.items.map(mapArticleSummary) };
};
