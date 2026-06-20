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

export function forbidden({ message } = {}) {
  return AppError.forbidden(message ?? 'Forbidden.');
}

export function resourceInactive(message) {
  return AppError.conflict(
    message ?? 'Cannot perform this action on an inactive resource.',
    {
      code: ERROR_CODES.RESOURCE_INACTIVE,
    },
  );
}

export function resourceDeleted(message) {
  return AppError.conflict(
    message ?? 'Cannot perform this action on a deleted resource.',
    {
      code: ERROR_CODES.RESOURCE_DELETED,
    },
  );
}

export function resourceStateChanged({ message } = {}) {
  return AppError.conflict(
    message ?? 'Resource state changed during request.',
    {
      code: ERROR_CODES.RESOURCE_STATE_CHANGED,
    },
  );
}

export function availabilityWindowNotFound(message) {
  return AppError.notFound(message ?? 'Availability window not found.', {
    code: ERROR_CODES.AVAILABILITY_WINDOW_NOT_FOUND,
  });
}

export function availabilityWindowStateChanged({ message } = {}) {
  return AppError.conflict(
    message ?? 'Availability window state changed during request.',
    {
      code: ERROR_CODES.AVAILABILITY_WINDOW_STATE_CHANGED,
    },
  );
}

export function reservationStateChanged({ message } = {}) {
  return AppError.conflict(
    message ?? 'Reservation state changed during request.',
    {
      code: ERROR_CODES.RESERVATION_STATE_CHANGED,
    },
  );
}
