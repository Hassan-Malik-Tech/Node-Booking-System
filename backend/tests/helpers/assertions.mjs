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
      message: 'Resource not found.',
    },
  });
}

export function expectForbiddenResponse(response) {
  expect(response.status).toBe(403);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Forbidden.',
    },
  });
}

export function expectAvailabilityWindowNotFoundResponse(response) {
  expect(response.status).toBe(404);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'AVAILABILITY_WINDOW_NOT_FOUND',
      message: 'Availability window not found.',
    },
  });
}

export function expectResourceDeletedResponse(response) {
  expect(response.status).toBe(409);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'RESOURCE_DELETED',
      message: 'Cannot create availability window for a deleted resource.',
    },
  });
}

export function expectResourceInactiveResponse(response) {
  expect(response.status).toBe(409);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'RESOURCE_INACTIVE',
      message: 'Cannot create availability window for an inactive resource.',
    },
  });
}

export function expectAvailabilityWindowConflictResponse(response) {
  expect(response.status).toBe(409);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'WINDOW_OVERLAP_OR_ADJACENCY',
      message:
        'Availability windows for the same resource cannot overlap or touch',
    },
  });
}

export function expectAllowedDurationLongerThanWindowResponse(response) {
  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'ALLOWED_DURATION_LONGER_THAN_WINDOW',
      message:
        'Allowed duration cannot be longer than the availability window.',
    },
  });
}
