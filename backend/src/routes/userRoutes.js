import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import requireAuth from '../middleware/requireAuth.js';
import validateRequest from '../middleware/validateRequest.js';
import loadCurrentStateOfAuthUser from '../middleware/loadCurrentStateOfAuthUser.js';
import requireRole from '../middleware/requireRole.js';
import {
  userIdParamsSchema,
  updateUserRoleAsAdminBodySchema,
  updateUserAsAdminBodySchema,
  createUserAsAdminBodySchema,
  listUsersForStaffQuerySchema,
} from '../validators/userSchemas.js';

const usersRouter = Router();

usersRouter.use(requireAuth, loadCurrentStateOfAuthUser);

usersRouter.patch(
  '/:userId/role',
  requireRole(['admin']),
  validateRequest({
    params: {
      schema: userIdParamsSchema,
      errorMessage: 'Invalid user id parameter.',
    },
    body: {
      schema: updateUserRoleAsAdminBodySchema,
      errorMessage: 'Invalid user role update request.',
    },
  }),
  userController.updateUserRoleAsAdmin,
);

usersRouter.post(
  '/',
  requireRole(['admin']),
  validateRequest({
    body: {
      schema: createUserAsAdminBodySchema,
      errorMessage: 'Invalid user create request.',
    },
  }),
  userController.createUserAsAdmin,
);

usersRouter.get(
  '/:userId',
  requireRole(['employee', 'admin']),
  validateRequest({
    params: {
      schema: userIdParamsSchema,
      errorMessage: 'Invalid user id parameter.',
    },
  }),
  userController.getUserByIdForStaff,
);

usersRouter.get(
  '/',
  requireRole(['employee', 'admin']),
  validateRequest({
    query: {
      schema: listUsersForStaffQuerySchema,
      errorMessage: 'Invalid user list query.',
    },
  }),
  userController.listUsersForStaff,
);

usersRouter.delete(
  '/:userId',
  requireRole(['admin']),
  validateRequest({
    params: {
      schema: userIdParamsSchema,
      errorMessage: 'Invalid user id parameter.',
    },
  }),
  userController.softDeleteUserAsAdmin,
);

usersRouter.patch(
  '/:userId',
  requireRole(['admin']),
  validateRequest({
    params: {
      schema: userIdParamsSchema,
      errorMessage: 'Invalid user id parameter.',
    },
    body: {
      schema: updateUserAsAdminBodySchema,
      errorMessage: 'Invalid user update request.',
    },
  }),
  userController.updateUserAsAdmin,
);

export default usersRouter;
