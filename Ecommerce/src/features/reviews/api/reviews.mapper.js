import {
  answerResponseSchema,
  questionResponseSchema,
  questionsResponseSchema,
  reviewEligibilityResponseSchema,
  reviewResponseSchema,
  reviewsResponseSchema,
} from './reviews.schemas';

const mapReview = review => ({
  ...review,
  product: review.productName,
  image: review.productImageUrl,
  text: review.body,
  date: new Date(review.updatedAt).toLocaleDateString('en-IN'),
  canEdit: review.allowedActions.includes('EDIT'),
  canDelete: review.allowedActions.includes('DELETE'),
});
export const mapReviews = payload => {
  const data = reviewsResponseSchema.parse(payload).data;
  return { ...data, items: data.items.map(mapReview) };
};
export const mapReviewResponse = payload => mapReview(reviewResponseSchema.parse(payload).data);
export const mapReviewEligibility = payload => reviewEligibilityResponseSchema.parse(payload).data;
const mapQuestion = question => ({
  ...question,
  product: question.productName,
  question: question.body,
  answer: question.answerPreview?.body || null,
  date: new Date(question.createdAt).toLocaleDateString('en-IN'),
});
export const mapQuestions = payload => {
  const data = questionsResponseSchema.parse(payload).data;
  return { ...data, items: data.items.map(mapQuestion) };
};
export const mapQuestionResponse = payload => {
  const question = questionResponseSchema.parse(payload).data;
  return {
    ...mapQuestion(question),
    answers: question.answers.map(answer => ({
      ...answer,
      text: answer.body,
      author: answer.authorDisplayName,
      date: new Date(answer.createdAt).toLocaleDateString('en-IN'),
    })),
  };
};
export const mapAnswerResponse = payload => answerResponseSchema.parse(payload).data;
