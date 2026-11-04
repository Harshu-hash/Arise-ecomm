import { AxiosError } from 'axios';
import { getProductCardFixture } from './customerSearchProductAdapter';

const LATENCY_MS = 220;
let questionCounter = 3;
let answerCounter = 3;
const answers = new Map([
  [
    'answer-1',
    {
      id: 'answer-1',
      body: 'Yes, 10 minutes of charging provides around 2 hours of playback.',
      authorDisplayName: 'Verified customer',
      authorType: 'CUSTOMER',
      helpfulCount: 18,
      viewerFoundHelpful: false,
      moderationStatus: 'PUBLISHED',
      createdAt: '2026-08-21T10:00:00.000Z',
    },
  ],
  [
    'answer-2',
    {
      id: 'answer-2',
      body: 'The product supports fast charging through its USB-C port.',
      authorDisplayName: 'Authorised seller',
      authorType: 'SELLER',
      helpfulCount: 5,
      viewerFoundHelpful: false,
      moderationStatus: 'PUBLISHED',
      createdAt: '2026-08-22T10:00:00.000Z',
    },
  ],
]);
const questions = new Map([
  [
    'question-1',
    {
      id: 'question-1',
      productId: 'e1',
      productName: 'boAt Airdopes 141 Bluetooth Truly Wireless Earbuds',
      body: 'Does this support fast charging?',
      authorDisplayName: 'Marketplace customer',
      answerIds: ['answer-1', 'answer-2'],
      moderationStatus: 'PUBLISHED',
      rejectionReason: null,
      createdAt: '2026-08-20T10:00:00.000Z',
      owned: true,
    },
  ],
  [
    'question-2',
    {
      id: 'question-2',
      productId: 'm1',
      productName: 'Samsung Galaxy M14 5G (ICY Silver, 128 GB)',
      body: 'Is this covered by the official India warranty?',
      authorDisplayName: 'Marketplace customer',
      answerIds: [],
      moderationStatus: 'PUBLISHED',
      rejectionReason: null,
      createdAt: '2026-07-05T10:00:00.000Z',
      owned: true,
    },
  ],
]);
const wait = () => new Promise(resolve => setTimeout(resolve, LATENCY_MS));
const response = (config, data, status = 200) => ({
  data,
  status,
  statusText: status < 400 ? 'OK' : 'Error',
  headers: { 'content-type': 'application/json' },
  config,
  request: null,
});
const reject = (config, status, code, message) => {
  throw new AxiosError(
    message,
    code,
    config,
    null,
    response(config, { error: { code, message } }, status),
  );
};
const dto = question => {
  const published = question.answerIds
    .map(id => answers.get(id))
    .filter(answer => answer?.moderationStatus === 'PUBLISHED');
  return {
    ...question,
    answersCount: published.length,
    answerPreview: published[0] || null,
    owned: undefined,
    answerIds: undefined,
  };
};
const detail = question => ({
  ...dto(question),
  answers: question.answerIds.map(id => answers.get(id)).filter(Boolean),
});
const page = (items, config) => {
  const offset = Number(config.params?.cursor || 0),
    limit = Math.min(Number(config.params?.limit || 10), 20);
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    nextCursor: offset + limit < items.length ? String(offset + limit) : null,
  };
};
export const resetCustomerQuestionsFixture = () => {
  questionCounter = 3;
  answerCounter = 3;
  for (const [id] of [...questions])
    if (Number(id.replace('question-', '')) >= 3) questions.delete(id);
  for (const [id] of [...answers]) if (Number(id.replace('answer-', '')) >= 3) answers.delete(id);
};
export const customerQuestionsFixtureAdapter = async config => {
  await wait();
  if (config.url === '/questions/mine' && config.method === 'get')
    return response(config, {
      data: page([...questions.values()].filter(item => item.owned).map(dto), config),
    });
  const productMatch = config.url?.match(/^\/products\/([^/]+)\/questions$/);
  if (productMatch && config.method === 'get') {
    const productId = decodeURIComponent(productMatch[1]);
    return response(config, {
      data: page(
        [...questions.values()]
          .filter(item => item.productId === productId && item.moderationStatus === 'PUBLISHED')
          .map(dto),
        config,
      ),
    });
  }
  if (config.url === '/questions' && config.method === 'post') {
    const { productId, body } = config.data || {};
    const product = getProductCardFixture(productId);
    if (!product) return reject(config, 404, 'PRODUCT_NOT_FOUND', 'This product was not found.');
    if (body?.trim().length < 5 || body.trim().length > 500)
      return reject(
        config,
        422,
        'QUESTION_INVALID',
        'Write a question between 5 and 500 characters.',
      );
    const question = {
      id: `question-${questionCounter++}`,
      productId,
      productName: product.name,
      body: body.trim(),
      authorDisplayName: 'Marketplace customer',
      answerIds: [],
      moderationStatus: 'PENDING',
      rejectionReason: null,
      createdAt: new Date().toISOString(),
      owned: true,
    };
    questions.set(question.id, question);
    return response(config, { data: detail(question) }, 201);
  }
  const answerMatch = config.url?.match(/^\/questions\/([^/]+)\/answers$/);
  if (answerMatch && config.method === 'post') {
    const question = questions.get(decodeURIComponent(answerMatch[1]));
    if (!question) return reject(config, 404, 'QUESTION_NOT_FOUND', 'This question was not found.');
    const body = config.data?.body?.trim();
    if (!body || body.length < 2 || body.length > 2000)
      return reject(
        config,
        422,
        'ANSWER_INVALID',
        'Write an answer between 2 and 2000 characters.',
      );
    const answer = {
      id: `answer-${answerCounter++}`,
      body,
      authorDisplayName: 'Marketplace customer',
      authorType: 'CUSTOMER',
      helpfulCount: 0,
      viewerFoundHelpful: false,
      moderationStatus: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    answers.set(answer.id, answer);
    question.answerIds.push(answer.id);
    return response(config, { data: answer }, 201);
  }
  const helpfulMatch = config.url?.match(/^\/answers\/([^/]+)\/helpful$/);
  if (helpfulMatch && ['put', 'delete'].includes(config.method)) {
    const answer = answers.get(decodeURIComponent(helpfulMatch[1]));
    if (!answer) return reject(config, 404, 'ANSWER_NOT_FOUND', 'This answer was not found.');
    const helpful = config.method === 'put';
    if (helpful !== answer.viewerFoundHelpful)
      answer.helpfulCount = Math.max(0, answer.helpfulCount + (helpful ? 1 : -1));
    answer.viewerFoundHelpful = helpful;
    return response(config, { data: answer });
  }
  const detailMatch = config.url?.match(/^\/questions\/([^/]+)$/);
  if (detailMatch && config.method === 'get') {
    const question = questions.get(decodeURIComponent(detailMatch[1]));
    if (!question) return reject(config, 404, 'QUESTION_NOT_FOUND', 'This question was not found.');
    return response(config, { data: detail(question) });
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};
