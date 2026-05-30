import AppError from './AppError.js';
import ERROR_CODES from './errorCodes.js';

export function invalidTokenError() {
  return AppError.unauthorized('Invalid or expired token.', {
    code: ERROR_CODES.INVALID_TOKEN,
  });
}
