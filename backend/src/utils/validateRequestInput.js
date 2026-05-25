import AppError from '../errors/AppError.js';
import { strictValidationOptions } from '../validators/joiOptions.js';

function formatJoiPath(path, requestLocation) {
  if (path.length === 0) {
    return requestLocation;
  }

  let formattedPath = '';

  for (const pathPart of path) {
    if (typeof pathPart === 'number') {
      // Number path parts are array indexes, so format them like [0].
      // This also handles a path that starts with a number, such as [0, 'email'].
      formattedPath += `[${pathPart}]`;
    } else if (formattedPath.length === 0) {
      // First string path part should not start with a dot.
      // Without this branch, ['user', 'email'] could become '.user.email'.
      formattedPath += pathPart;
    } else {
      // Later string path parts should be joined with dots.
      // Example: ['user', 'profile', 'email'] becomes 'user.profile.email'.
      // Without the conditional above it would become '.user.profile.email'.
      formattedPath += `.${pathPart}`;
    }
  }

  return formattedPath;
}

function joiErrorDetails(joiError, requestLocation) {
  return joiError.details.map((detail) => {
    return {
      // detail.path is the array; field is the formatted string sent in the response
      field: formatJoiPath(detail.path, requestLocation),
      message: detail.message,
    };
  });
}

function validateRequestInput({
  errorMessage,
  schema,
  values,
  validationOptions = strictValidationOptions,
  requestLocation,
}) {
  const { value, error } = schema.validate(values, validationOptions);

  if (error !== undefined) {
    const details = joiErrorDetails(error, requestLocation);

    throw AppError.validation(errorMessage, {
      details,
      cause: error,
    });
  }

  return value;
}

export default validateRequestInput;
