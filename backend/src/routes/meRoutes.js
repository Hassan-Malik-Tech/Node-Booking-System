import { Router } from 'express';
import * as meController from '../controllers/meController.js';
import requireAuth from '../middleware/requireAuth.js';
import validateRequest from '../middleware/validateRequest.js';
import requireRole from '../middleware/requireRole.js';
import loadCurrentStateOfAuthUser from '../middleware/loadCurrentStateOfAuthUser.js';
import {
  updateUserBodySchema,
  updatePasswordBodySchema,
} from '../validators/userSchemas.js';
import { listResourcesForOwnerQuerySchema } from '../validators/resourceSchemas.js';
import {
  listOwnReservationsQuerySchema,
  reservationIdParamsSchema,
  listReservationsForOwnedResourcesQuerySchema,
} from '../validators/reservationSchemas.js';

const meRouter = Router();

meRouter.use(requireAuth, loadCurrentStateOfAuthUser);

meRouter.get('/', meController.getProfile);

meRouter.patch(
  '/',
  validateRequest({
    body: {
      schema: updateUserBodySchema,
      errorMessage: 'Invalid profile update request body.',
    },
  }),
  meController.updateProfile,
);

meRouter.delete(
  '/',
  requireRole(['user'], {
    forbiddenMessage: 'Staff accounts cannot be deleted through this route.',
  }),
  meController.softDeleteOwnAccount,
);

meRouter.get(
  '/reservations/:reservationId',
  validateRequest({
    params: {
      schema: reservationIdParamsSchema,
      errorMessage: 'Invalid reservation id parameter.',
    },
  }),
  meController.getOwnReservation,
);

meRouter.get(
  '/resources/reservations',
  validateRequest({
    query: {
      schema: listReservationsForOwnedResourcesQuerySchema,
      errorMessage: 'Invalid owned resource reservation list query.',
    },
  }),
  meController.listReservationsForOwnedResources,
);

meRouter.get(
  '/resources',
  validateRequest({
    query: {
      schema: listResourcesForOwnerQuerySchema,
      errorMessage: 'Invalid resource list query.',
    },
  }),
  meController.listOwnedResources,
);

meRouter.get(
  '/reservations',
  validateRequest({
    query: {
      schema: listOwnReservationsQuerySchema,
      errorMessage: 'Invalid reservation list query.',
    },
  }),
  meController.listOwnReservations,
);

meRouter.patch(
  '/password',
  validateRequest({
    body: {
      schema: updatePasswordBodySchema,
      errorMessage: 'Invalid password update request body.',
    },
  }),
  meController.updatePassword,
);

export default meRouter;
