import {
  customerQuestionsFixtureAdapter,
  resetCustomerQuestionsFixture,
} from './customerQuestionsAdapter';

describe('customerQuestionsFixtureAdapter', () => {
  beforeEach(resetCustomerQuestionsFixture);
  it('lists product questions and loads stable detail IDs', async () => {
    const list = await customerQuestionsFixtureAdapter({
      url: '/products/e1/questions',
      method: 'get',
      params: { limit: 10 },
    });
    const detail = await customerQuestionsFixtureAdapter({
      url: '/questions/question-1',
      method: 'get',
    });
    expect(list.data.data).toMatchObject({ total: 1 });
    expect(detail.data.data).toMatchObject({ id: 'question-1', answersCount: 2 });
  });
  it('creates moderated questions and answers', async () => {
    const question = await customerQuestionsFixtureAdapter({
      url: '/questions',
      method: 'post',
      data: { productId: 'e1', body: 'Does it include a charging cable?' },
    });
    expect(question.data.data.moderationStatus).toBe('PENDING');
    const answer = await customerQuestionsFixtureAdapter({
      url: `/questions/${question.data.data.id}/answers`,
      method: 'post',
      data: { body: 'Yes, it is included.' },
    });
    expect(answer.data.data).toMatchObject({ moderationStatus: 'PENDING', authorType: 'CUSTOMER' });
  });
  it('tracks viewer helpfulness without duplicate increments', async () => {
    const first = await customerQuestionsFixtureAdapter({
      url: '/answers/answer-1/helpful',
      method: 'put',
    });
    const firstCount = first.data.data.helpfulCount;
    const repeated = await customerQuestionsFixtureAdapter({
      url: '/answers/answer-1/helpful',
      method: 'put',
    });
    const repeatedCount = repeated.data.data.helpfulCount;
    const removed = await customerQuestionsFixtureAdapter({
      url: '/answers/answer-1/helpful',
      method: 'delete',
    });
    expect(firstCount).toBe(19);
    expect(repeatedCount).toBe(19);
    expect(removed.data.data).toMatchObject({ helpfulCount: 18, viewerFoundHelpful: false });
  });
  it('rejects invalid question content', async () => {
    await expect(
      customerQuestionsFixtureAdapter({
        url: '/questions',
        method: 'post',
        data: { productId: 'e1', body: 'No' },
      }),
    ).rejects.toMatchObject({ response: { status: 422 } });
  });
});
