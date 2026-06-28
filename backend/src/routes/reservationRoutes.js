import { Router } from 'express';
import * as reservationController from '../controllers/reservationController.js';
import validateRequest from '../middleware/validateRequest.js';
import requireAuth from '../middleware/requireAuth.js';
import loadCurrentStateOfAuthUser from '../middleware/loadCurrentStateOfAuthUser.js';
import {
  bookReservationBodySchema,
  reservationIdParamsSchema,
  updateReservationPartySizeBodySchema,
  listReservationsForStaffQuerySchema,
} from '../validators/reservationSchemas.js';
import requireRole from '../middleware/requireRole.js';

const reservationsRouter = Router();

reservationsRouter.get(
  '/',
  requireAuth,
  loadCurrentStateOfAuthUser,
  requireRole(['employee', 'admin']),
  validateRequest({
    query: {
      schema: listReservationsForStaffQuerySchema,
      errorMessage: 'Invalid reservation list query.',
    },
  }),
  reservationController.listReservationsForStaff,
);

reservationsRouter.post(
  '/',
  requireAuth,
  loadCurrentStateOfAuthUser,
  validateRequest({
    body: {
      schema: bookReservationBodySchema,
      errorMessage: 'Invalid book reservation request body.',
    },
  }),
  reservationController.bookReservation,
);

reservationsRouter.get(
  '/:reservationId',
  requireAuth,
  loadCurrentStateOfAuthUser,
  requireRole(['employee', 'admin']),
  validateRequest({
    params: {
      schema: reservationIdParamsSchema,
      errorMessage: 'Invalid reservation id parameter.',
    },
  }),
  reservationController.getReservationByIdForStaff,
);

reservationsRouter.patch(
  '/:reservationId/cancel',
  requireAuth,
  loadCurrentStateOfAuthUser,
  validateRequest({
    params: {
      schema: reservationIdParamsSchema,
      errorMessage: 'Invalid reservation id parameter.',
    },
  }),
  reservationController.cancelReservation,
);

reservationsRouter.patch(
  '/:reservationId/complete',
  requireAuth,
  loadCurrentStateOfAuthUser,
  requireRole(['employee', 'admin']),
  validateRequest({
    params: {
      schema: reservationIdParamsSchema,
      errorMessage: 'Invalid reservation id parameter.',
    },
  }),
  reservationController.completeReservation,
);

reservationsRouter.patch(
  '/:reservationId/party-size',
  requireAuth,
  loadCurrentStateOfAuthUser,
  validateRequest({
    params: {
      schema: reservationIdParamsSchema,
      errorMessage: 'Invalid reservation id parameter.',
    },
    body: {
      schema: updateReservationPartySizeBodySchema,
      errorMessage: 'Invalid update reservation party size request body.',
    },
  }),
  reservationController.updateReservationPartySize,
);

export default reservationsRouter;
