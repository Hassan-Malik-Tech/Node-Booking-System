function makeErrorData({ statusCode, code, message, details, cause } = {}) {
  // = {} is not needed as the object should never be empty
  const errorData = {
    statusCode,
    code,
    message,
  };

  if (details !== undefined) {
    errorData.details = details;
  }

  if (cause !== undefined) {
    errorData.cause = cause;
  }

  return errorData;
}

class AppError extends Error {
  constructor({ statusCode, code, message, details, cause } = {}) {
    if (typeof message !== 'string' || message.trim().length === 0) {
      throw new TypeError('AppError message must be a non-empty string.');
    }

    super(message);

    // This overrides the default name "Error" from the parent Error class.
    // When you console.error an error created with this class,
    // it would show something like "AppError: Resource not found."
    // instead of "Error: Resource not found."
    // It changes the name of the stack trace.
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;

    if (details !== undefined) {
      this.details = details;
    }

    if (cause !== undefined) {
      this.cause = cause;
    } // use when for example you are translating db errors and you want to log the error
  }

  static validation(
    message,
    { code = 'VALIDATION_ERROR', details, cause } = {},
  ) {
    // with = {}, if the second argument is missing, the defaulted code would destructure from an empty object, which works, without = {}, it would destructor from undefined which would result in an error.
    // it is needed for optional object parameters even if code is defaulted

    const errorData = makeErrorData({
      statusCode: 400,
      code,
      message,
      details,
      cause,
    });

    return new AppError(errorData);
  }

  static badRequest(message, { code = 'BAD_REQUEST', details, cause } = {}) {
    const errorData = makeErrorData({
      statusCode: 400,
      code,
      message,
      details,
      cause,
    });

    return new AppError(errorData);
  }

  static unauthorized(
    message,
    { code = 'INVALID_CREDENTIALS', details, cause } = {},
  ) {
    const errorData = makeErrorData({
      statusCode: 401,
      code,
      message,
      details,
      cause,
    });

    return new AppError(errorData);
  }

  static forbidden(message, { code = 'FORBIDDEN', details, cause } = {}) {
    const errorData = makeErrorData({
      statusCode: 403,
      code,
      message,
      details,
      cause,
    });

    return new AppError(errorData);
  }

  static tooManyRequests(
    message,
    { code = 'TOO_MANY_REQUESTS', details, cause } = {},
  ) {
    const errorData = makeErrorData({
      statusCode: 429,
      code,
      message,
      details,
      cause,
    });

    return new AppError(errorData);
  }

  static notFound(message, { code = 'NOT_FOUND', details, cause } = {}) {
    const errorData = makeErrorData({
      statusCode: 404,
      code,
      message,
      details,
      cause,
    });

    return new AppError(errorData);
  }

  static conflict(message, { code = 'CONFLICT', details, cause } = {}) {
    const errorData = makeErrorData({
      statusCode: 409,
      code,
      message,
      details,
      cause,
    });

    return new AppError(errorData);
  }
}
// may add 405 Method Not Allowed

export default AppError;
