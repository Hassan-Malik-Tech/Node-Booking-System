import * as reservationService from '../services/reservationService.js';
import { success } from '../utils/response.js';

export async function listReservationsForStaff(req, res) {
  const queryParams = req.validated.query;

  const { data, pagination } =
    await reservationService.listReservationsForStaff({ queryParams });

  return res.status(200).json(success({ data, pagination }));
}

export async function getReservationByIdForStaff(req, res) {
  const reservationId = req.validated.params.reservationId;

  const { data } =
    await reservationService.getReservationByIdForStaff({ reservationId });

  return res.status(200).json(success({ data }));
}

export async function bookReservation(req, res) {
  const authUserId = req.user.id;
  const reservationData = req.validated.body;

  const { data, created } = await reservationService.bookReservation({
    authUserId,
    reservationData,
  });

  return res.status(created ? 201 : 200).json(success({ data }));
}

export async function cancelReservation(req, res) {
  const reservationId = req.validated.params.reservationId;
  const authUserId = req.user.id;

  const { data } = await reservationService.cancelReservation({
    reservationId,
    authUserId,
  });

  return res.status(200).json(success({ data }));
}

export async function completeReservation(req, res) {
  const reservationId = req.validated.params.reservationId;
  const authUserId = req.user.id;

  const { data } = await reservationService.completeReservation({
    reservationId,
    authUserId,
  });

  return res.status(200).json(success({ data }));
}

export async function updateReservationPartySize(req, res) {
  const reservationId = req.validated.params.reservationId;
  const authUserId = req.user.id;
  const partySize = req.validated.body.partySize;

  const { data } = await reservationService.updateReservationPartySize({
    reservationId,
    authUserId,
    partySize,
  });

  return res.status(200).json(success({ data }));
}
