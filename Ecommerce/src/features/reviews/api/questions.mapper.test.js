import { mapQuestionResponse, mapQuestions } from './reviews.mapper';

const answer = {
  id: 'answer-1',
  body: 'Yes, it does.',
  authorDisplayName: 'Seller',
  authorType: 'SELLER',
  helpfulCount: 2,
  viewerFoundHelpful: false,
  moderationStatus: 'PUBLISHED',
  createdAt: '2026-08-02T00:00:00.000Z',
};
const question = {
  id: 'question-1',
  productId: 'e1',
  productName: 'Earbuds',
  body: 'Does this support fast charging?',
  authorDisplayName: 'Customer',
  answersCount: 1,
  answerPreview: answer,
  moderationStatus: 'PUBLISHED',
  rejectionReason: null,
  createdAt: '2026-08-01T00:00:00.000Z',
};

describe('question mappers', () => {
  it('maps question previews', () => {
    const result = mapQuestions({ data: { items: [question], total: 1, nextCursor: null } });
    expect(result.items[0]).toMatchObject({
      product: 'Earbuds',
      question: question.body,
      answer: answer.body,
    });
  });
  it('maps answer detail presentation fields', () => {
    const result = mapQuestionResponse({ data: { ...question, answers: [answer] } });
    expect(result.answers[0]).toMatchObject({ author: 'Seller', text: 'Yes, it does.' });
  });
  it('rejects invalid author types', () => {
    expect(() =>
      mapQuestionResponse({
        data: { ...question, answers: [{ ...answer, authorType: 'UNKNOWN' }] },
      }),
    ).toThrow();
  });
});
