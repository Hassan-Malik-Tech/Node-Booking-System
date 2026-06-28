import * as meService from '../services/meService.js';
import { success } from '../utils/response.js';

export async function getProfile(req, res) {
  const { data } = await meService.getProfile({ user: req.user });

  return res.status(200).json(success({ data }));
}

export async function listOwnedResources(req, res) {
  const queryParams = req.validated.query;
  const authUserId = req.user.id;

  const { data, pagination } = await meService.listOwnedResources({
    queryParams,
    authUserId,
  });

  return res.status(200).json(success({ data, pagination }));
}

export async function listOwnReservations(req, res) {
  const queryParams = req.validated.query;
  const authUserId = req.user.id;

  const { data, pagination } = await meService.listOwnReservations({
    queryParams,
    authUserId,
  });

  return res.status(200).json(success({ data, pagination }));
}

export async function listReservationsForOwnedResources(req, res) {
  const queryParams = req.validated.query;
  const authUserId = req.user.id;

  const { data, pagination } =
    await meService.listReservationsForOwnedResources({
      queryParams,
      authUserId,
    });

  return res.status(200).json(success({ data, pagination }));
}

export async function getOwnReservation(req, res) {
  const authUserId = req.user.id;
  const reservationId = req.validated.params.reservationId;

  const { data } = await meService.getOwnReservation({
    authUserId,
    reservationId,
  });

  return res.status(200).json(success({ data }));
}

export async function updateProfile(req, res) {
  const authUserId = req.user.id;
  const updateData = req.validated.body;

  const { data } = await meService.updateProfile({
    authUserId,
    updateData,
  });

  return res.status(200).json(success({ data }));
}

export async function updatePassword(req, res) {
  const authUserId = req.auth.userId;
  const newPassword = req.validated.body.password;

  await meService.updatePassword({ authUserId, newPassword });

  return res.sendStatus(204);
}

export async function softDeleteOwnAccount(req, res) {
  const authUserId = req.user.id;

  const { data } = await meService.softDeleteOwnAccount({ authUserId });

  return res.status(200).json(success({ data }));
}
