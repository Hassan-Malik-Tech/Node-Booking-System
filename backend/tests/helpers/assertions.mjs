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

// To avoid refactoring old tests, response is kept outside of the options object.
export function expectForbiddenResponse(response, { message } = {}) {
  expect(response.status).toBe(403);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: message ?? 'Forbidden.',
    },
  });
}

export function expectAvailabilityWindowNotFoundResponse({
  response,
  message,
}) {
  expect(response.status).toBe(404);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'AVAILABILITY_WINDOW_NOT_FOUND',
      message: message ?? 'Availability window not found.',
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

export function expectResourceDeletedResponse({ response, message }) {
  expect(response.status).toBe(409);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'RESOURCE_DELETED',
      message,
    },
  });
}

export function expectResourceInactiveResponse({ response, message }) {
  expect(response.status).toBe(409);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'RESOURCE_INACTIVE',
      message,
    },
  });
}

export function expectNotAFutureAvailabilityWindowResponse({
  response,
  message,
}) {
  expect(response.status).toBe(409);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'NOT_A_FUTURE_AVAILABILITY_WINDOW',
      message,
    },
  });
}

export function expectCancelledReservationResponse({ response, reservation }) {
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    success: true,
    data: {
      reservationId: reservation.id,
      status: 'cancelled',
      cancelledAt: expect.any(String),
    },
  });
}

export function expectReservationNotFoundResponse({ response }) {
  expect(response.status).toBe(404);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'RESERVATION_NOT_FOUND',
      message: 'Reservation not found.',
    },
  });
}

export function expectReservationCompletedResponse({
  response,
  reservation,
  staff,
}) {
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    success: true,
    data: {
      id: reservation.id,
      userId: reservation.user.id,
      resourceId: reservation.resource.id,
      availabilityWindowId: reservation.availabilityWindow.id,
      startTime: reservation.start_time.toISOString(),
      endTime: reservation.end_time.toISOString(),
      partySize: reservation.party_size,
      status: 'completed',
      staffCompletedByUserId: staff.id,
      systemCompletedAt: null,
      staffCompletedAt: expect.any(String),
      cancelledAt: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    },
  });
}

export function expectReservationAlreadyCompletedResponse({
  response,
  message,
}) {
  expect(response.status).toBe(409);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'RESERVATION_ALREADY_COMPLETED',
      message: message ?? 'Reservation already completed.',
    },
  });
}

export function expectReservationAlreadyCancelledResponse({
  response,
  message,
}) {
  expect(response.status).toBe(409);
  expect(response.body).toEqual({
    success: false,
    error: {
      code: 'RESERVATION_ALREADY_CANCELLED',
      message: message ?? 'Reservation is already cancelled.',
    },
  });
}
