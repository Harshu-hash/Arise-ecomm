import { CATEGORY, notify } from '../../notification/public/index.js';

// Who hears about Q&A. Called after the change has committed; notify() never throws and tells each person once per key.

/** A question went public: every seller selling the product right now (`sellerIds`) gets it in their bell. */
export const announceQuestion = (question, sellerIds) => Promise.all(sellerIds.map((sellerId) => notify({
  to: { type: 'SELLER', id: sellerId },
  category: CATEGORY.SUPPORT,
  key: `question:${question._id}`,
  title: 'New customer question',
  body: `A customer asked about ${question.productName}: "${question.body.slice(0, 120)}"`,
  link: '/customer-experience/questions',
})));

/** An answer went public: the person who asked hears about it (unless they wrote it). */
export const announceAnswer = (question, answer) => answer.authorId === question.customerId
  ? null
  : notify({
    to: { type: 'CUSTOMER', id: question.customerId },
    category: CATEGORY.SUPPORT,
    key: `answer:${answer._id}`,
    title: 'Your question was answered',
    body: `${answer.authorName} answered your question about ${question.productName}.`,
    target: { type: 'PRODUCT', entityId: question.productId },
  });

export const tellAsker = (question, title, body) => notify({
  to: { type: 'CUSTOMER', id: question.customerId },
  category: CATEGORY.SUPPORT,
  key: `question-rejected:${question._id}:${question.updatedAt.getTime()}`,
  title,
  body,
  target: { type: 'PRODUCT', entityId: question.productId },
});
