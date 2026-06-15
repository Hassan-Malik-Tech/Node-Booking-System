import * as sqlReservationQueries from './sql/reservationQueries.js';

export const cancelUpcomingReservationsOverCapacity =
  sqlReservationQueries.cancelUpcomingReservationsOverCapacity;

export const cancelUpcomingReservationsByResourceId =
  sqlReservationQueries.cancelUpcomingReservationsByResourceId;

export const cancelUpcomingReservationsOutsideAvailabilityWindow =
  sqlReservationQueries.cancelUpcomingReservationsOutsideAvailabilityWindow;

export const cancelUpcomingReservationsByAvailabilityWindowId =
  sqlReservationQueries.cancelUpcomingReservationsByAvailabilityWindowId;

export const createReservation = sqlReservationQueries.createReservation;

export const cancelReservationById =
  sqlReservationQueries.cancelReservationById;

export const getFutureActiveReservationsByWindowId =
  sqlReservationQueries.getFutureActiveReservationsByWindowId;
