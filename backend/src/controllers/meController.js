import * as meService from '../services/meService.js';
import { success } from '../utils/response.js';

export async function getProfile(req, res) {
  const userId = req.auth.userId;

  const { data } = await meService.getProfile(userId);

  return res.status(200).json(success({ data }));
}
