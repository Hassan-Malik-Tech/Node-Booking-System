import * as reservationQueries from '../../data-access/reservations.js';
import * as db from '../../db/db.js';
import AppError from '../../errors/AppError.js';
import ERROR_CODES from '../../errors/errorCodes.js';
import { forbidden } from '../../errors/commonErrors.js';

export async function getReservationOrThrow({
  reservationId,
  futureAndCurrentActive = false,
  futureActiveOnly = false,
  forUpdate = false,
  client = db,
}) {
  if (forUpdate && client === db) {
    throw new Error('Cannot use FOR UPDATE without a transaction client.');
  }

  const reservation = await reservationQueries.getReservationById({
    reservationId,
    futureAndCurrentActive,
    futureActiveOnly,
    forUpdate,
    client,
  });

  if (!reservation) {
    throw AppError.notFound('Reservation not found.', {
      code: ERROR_CODES.RESERVATION_NOT_FOUND,
    });
  }

  return reservation;
}

export function requireReservationOwner({ reservation, authUserId }) {
  if (reservation.user_id !== authUserId) {
    throw forbidden();
  }
}

export function requireNotCancelled({ reservation, message }) {
  if (reservation.status === 'cancelled') {
    throw AppError.conflict(
      message ??
        'Cannot perform this action on a reservation that is already cancelled.',
      {
        code: ERROR_CODES.RESERVATION_ALREADY_CANCELLED,
      },
    );
  }
}

export function requireNotCompleted({ reservation, message }) {
  if (reservation.status === 'completed') {
    throw AppError.conflict(
      message ??
        'Cannot perform this action on a reservation that is already completed.',
      {
        code: ERROR_CODES.RESERVATION_ALREADY_COMPLETED,
      },
    );
  }
}

export function requireActiveReservationHasNotEnded({
  reservation,
  now,
  message,
}) {
  if (
    reservation.status === 'active' &&
    reservation.end_time.getTime() <= now
  ) {
    throw AppError.conflict(
      message ?? 'Cannot perform this action on a past reservation.',
      {
        code: ERROR_CODES.RESERVATION_ALREADY_ENDED,
      },
    );
  }
}

export function requireReservationNotOngoing({ reservation, now, message }) {
  if (
    reservation.start_time.getTime() <= now &&
    reservation.end_time.getTime() > now
  ) {
    throw AppError.conflict(
      message ??
        'Cannot perform this action on a reservation that has already started.',
      {
        code: ERROR_CODES.RESERVATION_ALREADY_STARTED,
      },
    );
  }
}

export function requireReservationStarted({ reservation, now, message }) {
  if (reservation.start_time.getTime() > now) {
    throw AppError.conflict(
      message ??
        'Cannot perform this action on a reservation that has not started yet.',
      {
        code: ERROR_CODES.RESERVATION_NOT_STARTED,
      },
    );
  }
}

export function requirePartySizeWithinResourceCapacity({
  partySize,
  resourceCapacity,
}) {
  if (partySize > resourceCapacity) {
    throw AppError.badRequest(
      `Reservation party size cannot exceed resource capacity of ${resourceCapacity}.`,
      {
        code: ERROR_CODES.RESERVATION_PARTY_SIZE_EXCEEDS_CAPACITY,
      },
    );
  }
}
