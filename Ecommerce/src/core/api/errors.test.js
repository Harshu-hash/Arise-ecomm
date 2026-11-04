import { normalizeApiError } from './errors';

describe('normalizeApiError', () => {
  it('preserves the server error contract', () => {
    const result = normalizeApiError({
      isAxiosError: true,
      response: {
        status: 422,
        headers: { 'x-request-id': 'req_header' },
        data: {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Check the highlighted fields.',
            fieldErrors: { phone: 'Enter a valid phone number.' },
            requestId: 'req_body',
          },
        },
      },
    });

    expect(result).toMatchObject({
      normalized: true,
      code: 'VALIDATION_FAILED',
      status: 422,
      requestId: 'req_body',
      retryable: false,
      fieldErrors: { phone: 'Enter a valid phone number.' },
    });
  });

  it('marks a network failure as retryable', () => {
    const result = normalizeApiError({ isAxiosError: true, message: 'Network Error' });

    expect(result).toMatchObject({
      code: 'NETWORK_ERROR',
      status: null,
      retryable: true,
    });
  });

  it('does not discard an already-normalized error', () => {
    const error = { normalized: true, code: 'SESSION_EXPIRED' };
    expect(normalizeApiError(error)).toBe(error);
  });
});
