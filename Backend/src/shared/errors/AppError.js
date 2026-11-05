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

