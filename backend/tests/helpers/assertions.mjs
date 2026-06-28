import { expect } from '@jest/globals';

// For errors with no details that appear once or twice.
// If the error appears more than twice, it should get its own assertion helper.
export function expectNoDetailsErrorResponse({
  response,
  status,
  code,
  message,
}) {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({
    success: false,
    error: {
      code,
      message,
    },
  });
}

export function expectNoPasswordFields(user) {
  expect(user.password).toBeUndefined();
  expect(user.passwordHash).toBeUndefined();
  expect(user.password_hash).toBeUndefined();
}

// Status code goes here because it should not differ
// unlike password field where there can be different
// success status codes.
export function expectAuthRequiredResponse(response) {
  expectNoDetailsErrorResponse({
    response,
    status: 401,
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Authentication required',
  });
}

export function expectInvalidTokenResponse(response) {
  expectNoDetailsErrorResponse({
    response,
    status: 401,
    code: 'INVALID_TOKEN',
    message: 'Invalid or expired token.',
  });
}

export function expectInvalidCredentialsResponse(response) {
  expectNoDetailsErrorResponse({
    response,
    status: 401,
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password.',
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
  expectNoDetailsErrorResponse({
    response,
    status: 404,
    code: 'RESOURCE_NOT_FOUND',
    message: 'Resource not found.',
  });
}

// To avoid refactoring old tests, response is kept outside of the options object.
export function expectForbiddenResponse(response, { message } = {}) {
  expectNoDetailsErrorResponse({
    response,
    status: 403,
    code: 'FORBIDDEN',
    message: message ?? 'Forbidden.',
  });
}

export function expectAvailabilityWindowNotFoundResponse({
  response,
  message,
}) {
  expectNoDetailsErrorResponse({
    response,
    status: 404,
    code: 'AVAILABILITY_WINDOW_NOT_FOUND',
    message: message ?? 'Availability window not found.',
  });
}

export function expectAvailabilityWindowConflictResponse(response) {
  expectNoDetailsErrorResponse({
    response,
    status: 409,
    code: 'WINDOW_OVERLAP_OR_ADJACENCY',
    message:
      'Availability windows for the same resource cannot overlap or touch',
  });
}

export function expectAllowedDurationLongerThanWindowResponse(response) {
  expectNoDetailsErrorResponse({
    response,
    status: 400,
    code: 'ALLOWED_DURATION_LONGER_THAN_WINDOW',
    message: 'Allowed duration cannot be longer than the availability window.',
  });
}

export function expectResourceDeletedResponse({ response, message }) {
  expectNoDetailsErrorResponse({
    response,
    status: 409,
    code: 'RESOURCE_DELETED',
    message,
  });
}

export function expectResourceInactiveResponse({ response, message }) {
  expectNoDetailsErrorResponse({
    response,
    status: 409,
    code: 'RESOURCE_INACTIVE',
    message,
  });
}

export function expectNotAFutureAvailabilityWindowResponse({
  response,
  message,
}) {
  expectNoDetailsErrorResponse({
    response,
    status: 409,
    code: 'NOT_A_FUTURE_AVAILABILITY_WINDOW',
    message,
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

export function expectReservationNotFoundResponse({ response, message }) {
  expectNoDetailsErrorResponse({
    response,
    status: 404,
    code: 'RESERVATION_NOT_FOUND',
    message: message ?? 'Reservation not found.',
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
  expectNoDetailsErrorResponse({
    response,
    status: 409,
    code: 'RESERVATION_ALREADY_COMPLETED',
    message: message ?? 'Reservation already completed.',
  });
}

export function expectReservationAlreadyCancelledResponse({
  response,
  message,
}) {
  expectNoDetailsErrorResponse({
    response,
    status: 409,
    code: 'RESERVATION_ALREADY_CANCELLED',
    message: message ?? 'Reservation is already cancelled.',
  });
}

export function expectUserNotFoundResponse({ response }) {
  expectNoDetailsErrorResponse({
    response,
    status: 404,
    code: 'USER_NOT_FOUND',
    message: 'User not found.',
  });
}

export function expectReservationsListResponse(
  { response, pagination },
  ...reservations
) {
  const dataArr = [];

  for (const [reservation, status] of reservations) {
    dataArr.push({
      id: reservation.id,
      userId: reservation.user.id,
      resourceId: reservation.resource.id,
      availabilityWindowId: reservation.availabilityWindow.id,
      startTime: reservation.start_time.toISOString(),
      endTime: reservation.end_time.toISOString(),
      partySize: reservation.party_size,
      status,
      staffCompletedByUserId: reservation.staff_completed_by_user_id,
      systemCompletedAt:
        reservation.system_completed_at === null ? null : expect.any(String),
      staffCompletedAt:
        reservation.staff_completed_at === null ? null : expect.any(String),
      cancelledAt:
        reservation.cancelled_at === null ? null : expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  }

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    success: true,
    data: expect.arrayContaining(dataArr),
    pagination,
  });
}

export function expectGetReservationResponse({
  response,
  reservation,
  expectedStatus,
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
      status: expectedStatus ?? reservation.status,
      staffCompletedByUserId: reservation.staff_completed_by_user_id,
      systemCompletedAt:
        reservation.system_completed_at === null
          ? null
          : reservation.system_completed_at.toISOString(),
      staffCompletedAt:
        reservation.staff_completed_at === null
          ? null
          : reservation.staff_completed_at.toISOString(),
      cancelledAt:
        reservation.cancelled_at === null
          ? null
          : reservation.cancelled_at.toISOString(),
      createdAt: reservation.created_at.toISOString(),
      updatedAt: reservation.updated_at.toISOString(),
    },
  });
}

export function expectUserDeletedByAdminResponse({
  response,
  user,
  role,
  resourcesDeleted,
  availabilityWindowsDeleted,
  upcomingReservationsCancelledOnDeletedUserResources,
  deletedUserUpcomingReservationsCancelled,
}) {
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    success: true,
    data: {
      deletedUser: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: role ?? user.role,
        createdAt: user.created_at.toISOString(),
        updatedAt: expect.any(String),
        deletedAt: expect.any(String),
      },
      resourcesDeleted: resourcesDeleted ?? 0,
      availabilityWindowsDeleted: availabilityWindowsDeleted ?? 0,
      upcomingReservationsCancelledOnDeletedUserResources:
        upcomingReservationsCancelledOnDeletedUserResources ?? 0,
      deletedUserUpcomingReservationsCancelled:
        deletedUserUpcomingReservationsCancelled ?? 0,
    },
  });
}

export function expectGetUserByIdForStaffResponse({
  response,
  user,
  deletedAt = null,
}) {
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.created_at.toISOString(),
      updatedAt: user.updated_at.toISOString(),
      deletedAt,
    },
  });
}

export function expectGetOwnReservationResponse({
  response,
  reservation,
  expectedStatus,
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
      status: expectedStatus ?? reservation.status,
      completedAt:
        reservation.system_completed_at === null
          ? null
          : reservation.system_completed_at.toISOString(),
      cancelledAt:
        reservation.cancelled_at === null
          ? null
          : reservation.cancelled_at.toISOString(),
      createdAt: reservation.created_at.toISOString(),
      updatedAt: reservation.updated_at.toISOString(),
    },
  });
}

export function expectUsersListResponse({ response, pagination }, ...users) {
  const dataArr = [];

  for (const { user, role, deletedAt } of users) {
    let deletedAtValue;

    if (deletedAt !== undefined) {
      deletedAtValue = deletedAt;
    } else {
      deletedAtValue =
        user.deleted_at === null ? null : user.deleted_at.toISOString();
    }

    dataArr.push({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: role ?? user.role,
      createdAt: user.created_at.toISOString(),
      updatedAt: user.updated_at.toISOString(),
      deletedAt: deletedAtValue,
    });
  }

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    success: true,
    data: expect.arrayContaining(dataArr),
    pagination,
  });
}
