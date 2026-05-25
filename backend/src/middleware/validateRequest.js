import validateRequestInput from '../utils/validateRequestInput.js';
import { headerValidationOptions } from '../validators/joiOptions.js';

function validateRequest({ params, query, body, headers }) {
  return function validateRequestMiddleware(req, res, next) {
    try {
      const validated = {};

      if (params !== undefined) {
        validated.params = validateRequestInput({
          schema: params.schema,
          values: req.params,
          errorMessage: params.errorMessage ?? 'Invalid route params.',
          requestLocation: 'params',
        });
      }

      if (query !== undefined) {
        validated.query = validateRequestInput({
          schema: query.schema,
          values: req.query,
          errorMessage: query.errorMessage ?? 'Invalid query params.',
          requestLocation: 'query',
        });
      }

      if (body !== undefined) {
        validated.body = validateRequestInput({
          schema: body.schema,
          values: req.body,
          errorMessage: body.errorMessage ?? 'Invalid request body.',
          requestLocation: 'body',
        });
      }

      if (headers !== undefined) {
        validated.headers = validateRequestInput({
          schema: headers.schema,
          values: req.headers,
          errorMessage: headers.errorMessage ?? 'Invalid request headers.',
          validationOptions: headerValidationOptions,
          requestLocation: 'headers',
        });
      }

      req.validated = {
        // If header is validated before body, query, and params then req.validated would alread exist, so it is spread.
        // Spreading undefined or null in an object does not result in an error
        // but this is more explicit and the intent is more obvious.
        ...(req.validated ?? {}),
        // Have to spread validaed or you will end up with req.validated.validated.body instead of req.validated.body
        ...validated,
      };

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export default validateRequest;

/*
Header validation rule:

Header Joi schemas should validate known headers if they are present, but should not make headers required by default.

The middleware that owns a specific header should decide whether that header is required and return the correct error code.

Examples:
- validateRequests validates/normalizes optional headers like authorization and idempotency-key.
- requireAuth requires authorization and returns 401 AUTHENTICATION_REQUIRED or INVALID_AUTHORIZATION_HEADER.
- requireIdempotencyKey requires idempotency-key and returns an idempotency-specific error code.

This prevents missing auth from becoming a generic Joi validation error and keeps each header’s behavior owned by the middleware that actually uses it.
*/
