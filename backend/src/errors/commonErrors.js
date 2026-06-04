import AppError from './AppError.js';
import ERROR_CODES from './errorCodes.js';

export function invalidTokenError() {
  return AppError.unauthorized('Invalid or expired token.', {
    code: ERROR_CODES.INVALID_TOKEN,
  });
}

export function resourceNotFound() {
  return AppError.notFound('Resource not found.', {
    code: ERROR_CODES.RESOURCE_NOT_FOUND,
  });
}

export function forbidden() {
  return AppError.forbidden('Forbidden.');
}

export function resourceInactive() {
  return AppError.conflict(
    'Cannot create availability window for an inactive resource.',
    {
      code: ERROR_CODES.RESOURCE_INACTIVE,
    },
  );
}

export function resourceDeleted() {
  return AppError.conflict(
    'Cannot create availability window for a deleted resource.',
    {
      code: ERROR_CODES.RESOURCE_DELETED,
    },
  );
}
