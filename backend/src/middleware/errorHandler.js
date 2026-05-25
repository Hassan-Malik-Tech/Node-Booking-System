import AppError from '../errors/AppError.js';
import ERROR_CODES from '../errors/errorCodes.js';
import { error } from '../utils/response.js';

// Express recognizes error-handling middleware by the 4 parameters, so 4 is a must not 3
export default function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res
      .status(err.status)
      .json(error({ code: ERROR_CODES.INVALID_JSON, message: 'Invalid JSON' }));
  }

  if (err instanceof AppError) {
    if (err.cause !== undefined) {
      console.error(err.cause);
    }

    return res
      .status(err.statusCode)
      .json(
        error({ code: err.code, message: err.message, details: err.details }),
      );
  }

  console.error(err); // logs unknown errors that bypass the 2 conditionals above

  return res
    .status(500)
    .json(error({ code: ERROR_CODES.INTERNAL_ERROR, message: 'server error' }));
}

// I used err.status for invalid json(comes by default) and err.statusCode AppError class because they are available.
// with server error, there is no err.status to use, so I had to hard code it.
