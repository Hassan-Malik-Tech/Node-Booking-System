import * as sqlReservationQueries from './sql/reservationQueries.js';

export const cancelUpcomingReservationsOverCapacity =
  sqlReservationQueries.cancelUpcomingReservationsOverCapacity;

export const cancelUpcomingReservationsByResourceId =
  sqlReservationQueries.cancelUpcomingReservationsByResourceId;

export const createReservation = sqlReservationQueries.createReservation;
