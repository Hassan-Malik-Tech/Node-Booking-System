import * as userService from '../services/userService.js';
import { success } from '../utils/response.js';

export async function listUsersForStaff(req, res) {
  const queryParams = req.validated.query;

  const { data, pagination } = await userService.listUsersForStaff({
    queryParams,
  });

  return res.status(200).json(success({ data, pagination }));
}

export async function getUserByIdForStaff(req, res) {
  const userId = req.validated.params.userId;

  const { data } = await userService.getUserByIdForStaff({
    userId,
  });

  return res.status(200).json(success({ data }));
}

export async function softDeleteUserAsAdmin(req, res) {
  const authUserId = req.user.id;
  const targetUserId = req.validated.params.userId;

  const { data } = await userService.softDeleteUserAsAdmin({
    authUserId,
    targetUserId,
  });

  return res.status(200).json(success({ data }));
}

export async function updateUserRoleAsAdmin(req, res) {
  const authUserId = req.user.id;
  const targetUserId = req.validated.params.userId;
  const newRole = req.validated.body.newRole;

  const { data } = await userService.updateUserRoleAsAdmin({
    authUserId,
    targetUserId,
    newRole,
  });

  return res.status(200).json(success({ data }));
}

export async function updateUserAsAdmin(req, res) {
  const authUserId = req.user.id;
  const targetUserId = req.validated.params.userId;
  const updateData = req.validated.body;

  const { data } = await userService.updateUserAsAdmin({
    authUserId,
    targetUserId,
    updateData,
  });

  return res.status(200).json(success({ data }));
}

export async function createUserAsAdmin(req, res) {
  const authUserId = req.user.id;
  const userData = req.validated.body;

  const { data } = await userService.createUserAsAdmin({
    authUserId,
    userData,
  });

  return res
    .status(201)
    .location(`/api/users/${data.id}`)
    .json(success({ data }));
}
