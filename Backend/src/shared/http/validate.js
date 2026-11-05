import { ValidationError } from '../errors/AppError.js';

function flattenZodErrors(error) {
  return error.issues.reduce((result, issue) => {
    const key = issue.path.join('.') || '_request';
    (result[key] ??= []).push(issue.message);
    return result;
  }, {});
}

export function validate(schemas) {
  return (req, _res, next) => {
    try {
      for (const target of ['params', 'query', 'body']) {
        const schema = schemas[target];
        if (!schema) continue;
        const result = schema.safeParse(req[target]);
        if (!result.success) throw new ValidationError(undefined, flattenZodErrors(result.error));
        req[target] = result.data;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

