import { expect } from '@jest/globals';

export function expectNoPasswordFields(user) {
  expect(user.password).toBeUndefined();
  expect(user.passwordHash).toBeUndefined();
  expect(user.password_hash).toBeUndefined();
}

// Status code goes here because it should not differ
// unlike password field where there can be different
// success status codes.
export function expectAuthRequiredResponse(response) {
  expect(response.status).toBe(401);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required',
    },
  });
}

export function expectInvalidTokenResponse(response) {
  expect(response.status).toBe(401);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'INVALID_TOKEN',
      message: 'Invalid or expired token.',
    },
  });
}

export function expectInvalidCredentialsResponse(response) {
  expect(response.status).toBe(401);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid username or password.',
    },
  });
}

export function expectValidationErrorResponse({
  response,
  errorMessage,
  field,
  detailsMessage,
}) {
  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: errorMessage,
      details: [
        {
          field,
          message: detailsMessage,
        },
      ],
    },
  });
}

export function expectResourceNotFoundResponse(response) {
  expect(response.status).toBe(404);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'RESOURCE_NOT_FOUND',
      message: 'Resource not found',
    },
  });
}
