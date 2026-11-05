import { AppError } from '../errors/AppError.js';
import { env } from '../../config/env.js';
import { getRequestContext } from './requestContext.js';

export function errorHandler(error, req, res, _next) {
  const known = error instanceof AppError;
  const status = known ? error.status : 500;
  const requestId = getRequestContext().requestId ?? req.id ?? null;

  req.log[status >= 500 ? 'error' : 'warn']({ err: error, requestId }, 'Request failed');

  const body = {
    error: {
      code: known ? error.code : 'INTERNAL_ERROR',
      message: known ? error.message : 'An unexpected error occurred.',
      requestId,
      retryable: known ? error.retryable : true,
    },
  };

  if (known && error.fieldErrors) body.error.fieldErrors = error.fieldErrors;
  if (known && error.details) body.error.details = error.details;
  if (!env.isProduction && !known) body.error.debug = error.message;

  res.status(status).json(body);
}

