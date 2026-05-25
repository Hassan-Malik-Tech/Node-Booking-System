import translatePgError from './translatePgError.js';
import AppError from './AppError.js';

function caughtError(error) {
  // for instances where AppError is thrown in the try block
  if (error instanceof AppError) {
    return error;
  }

  // translatePgError returns null for unknown errors.
  // Returning the original error lets the global error middleware handle it as a 500 server error.
  return translatePgError(error) ?? error;
}

export default caughtError;
