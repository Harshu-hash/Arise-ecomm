export const REVIEW_ENDPOINTS = {
  mine: '/reviews/mine',
  product: productId => `/products/${encodeURIComponent(productId)}/reviews`,
  eligibility: orderItemId => `/order-items/${encodeURIComponent(orderItemId)}/review-eligibility`,
  create: '/reviews',
  detail: reviewId => `/reviews/${encodeURIComponent(reviewId)}`,
};
export const QUESTION_ENDPOINTS = {
  mine: '/questions/mine',
  product: productId => `/products/${encodeURIComponent(productId)}/questions`,
  create: '/questions',
  detail: questionId => `/questions/${encodeURIComponent(questionId)}`,
  answers: questionId => `/questions/${encodeURIComponent(questionId)}/answers`,
  helpful: answerId => `/answers/${encodeURIComponent(answerId)}/helpful`,
};
