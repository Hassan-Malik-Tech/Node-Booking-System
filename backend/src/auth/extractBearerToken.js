import AppError from '../errors/AppError.js';
import ERROR_CODES from '../errors/errorCodes.js';

// I will not validate authorization header with joi as I want a specific 401 (unauthorized) response.
function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader) {
    throw AppError.unauthorized('Authentication required', {
      code: ERROR_CODES.AUTHENTICATION_REQUIRED,
    });
  }

  // Has to be before headerParts because .trim() and .split() are string methods.
  if (typeof authorizationHeader !== 'string') {
    throw AppError.unauthorized('Invalid authorization header', {
      code: ERROR_CODES.INVALID_AUTHORIZATION_HEADER,
    });
  }

  const headerParts = authorizationHeader.trim().split(/\s+/);

  if (headerParts.length !== 2 || headerParts[0].toLowerCase() !== 'bearer') {
    throw AppError.unauthorized('Invalid authorization header', {
      code: ERROR_CODES.INVALID_AUTHORIZATION_HEADER,
    });
  }

  const token = headerParts[1];

  return token;
}

export default extractBearerToken;
