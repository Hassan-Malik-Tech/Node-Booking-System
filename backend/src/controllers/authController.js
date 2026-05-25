import * as authService from '../services/authService.js';
import { success } from '../utils/response.js';

export async function registerUser(req, res) {
  const userData = req.validated.body;

  const { data } = await authService.registerUser(userData);

  return res.status(201).json(success({ data }));
}

export async function loginUser(req, res) {
  const userData = req.validated.body;

  const { data } = await authService.loginUser(userData);

  return res
    .status(200)
    .set('Cache-Control', 'no-store')
    .set('Pragma', 'no-cache') // Historical, not needed but harmless to have.
    .json(success({ data }));
}
