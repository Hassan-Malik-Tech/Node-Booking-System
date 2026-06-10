import * as meService from '../services/meService.js';
import { success } from '../utils/response.js';

export async function getProfile(req, res) {
  const { data } = await meService.getProfile(req.user);

  return res.status(200).json(success({ data }));
}

export async function updateProfile(req, res) {
  const {
    id: userId,
    username: currentUsername,
    email: currentEmail,
  } = req.user;

  const updateData = req.validated.body;

  const { data } = await meService.updateProfile({
    userId,
    updateData,
    currentUsername,
    currentEmail,
  });

  return res.status(200).json(success({ data }));
}

export async function updatePassword(req, res) {
  const userId = req.auth.userId;
  const newPassword = req.validated.body.password;

  await meService.updatePassword({ userId, newPassword });

  return res.sendStatus(204);
}
