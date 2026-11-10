export class AppError extends Error {
  constructor({ code, message, status = 500, details = null, fieldErrors = null, retryable = false, cause }) {
    super(message, { cause });
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
    this.fieldErrors = fieldErrors;
    this.retryable = retryable;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Request validation failed.', fieldErrors = null) {
    super({ code: 'VALIDATION_ERROR', message, status: 422, fieldErrors });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found.') {
    super({ code: 'NOT_FOUND', message, status: 404 });
  }
}

export class ConflictError extends AppError {
  constructor(code = 'CONFLICT', message = 'The request conflicts with current state.', details = null) {
    super({ code, message, status: 409, details });
  }
}


export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication is required.') {
    super({ code: 'UNAUTHORIZED', message, status: 401 });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super({ code: 'FORBIDDEN', message, status: 403 });
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super({ code: 'RATE_LIMITED', message, status: 429, retryable: true });
  }
}
