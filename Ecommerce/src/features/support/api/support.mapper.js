import {
  helpArticleResponseSchema,
  helpCategoriesResponseSchema,
  helpCategoryResponseSchema,
  helpSearchResponseSchema,
  chatListResponseSchema,
  chatResponseSchema,
  supportChannelsResponseSchema,
} from './support.schemas';
export const mapSupportChannels = payload => supportChannelsResponseSchema.parse(payload).data;
export const mapChatList = payload => {
  const data = chatListResponseSchema.parse(payload).data;
  return {
    ...data,
    items: data.items.map(chat => ({ ...chat, date: new Date(chat.lastMessageAt).toLocaleDateString('en-IN') })),
  };
};
export const mapChat = payload => {
  const chat = chatResponseSchema.parse(payload).data;
  return (
    chat && {
      ...chat,
      messages: chat.messages.map(message => ({
        ...message,
        date: new Date(message.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      })),
    }
  );
};
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
