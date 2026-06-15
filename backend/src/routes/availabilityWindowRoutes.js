import { Router } from 'express';
import * as availabilityWindowController from '../controllers/availabilityWindowController.js';
import validateRequest from '../middleware/validateRequest.js';
import {
  listAvailabilityWindowsQuerySchema,
  availabilityWindowIdParamsSchema,
  updateAvailabilityWindowBodySchema,
  bulkAllowedDurationsSchema,
  deleteAllowedDurationParamsSchema,
} from '../validators/availabilityWindowSchemas.js';
import requireRole from '../middleware/requireRole.js';
import requireAuth from '../middleware/requireAuth.js';
import loadCurrentStateOfAuthUser from '../middleware/loadCurrentStateOfAuthUser.js';

const availabilityWindowsRouter = Router();

availabilityWindowsRouter.get(
  '/',
  requireAuth,
  loadCurrentStateOfAuthUser,
  requireRole(['employee', 'admin']),
  validateRequest({
    query: {
      schema: listAvailabilityWindowsQuerySchema,
      errorMessage: 'Invalid availability window list query.',
    },
  }),
  availabilityWindowController.listAvailabilityWindows,
);

availabilityWindowsRouter.get(
  '/:availabilityWindowId',
  requireAuth,
  loadCurrentStateOfAuthUser,
  requireRole(['employee', 'admin']),
  validateRequest({
    params: {
      schema: availabilityWindowIdParamsSchema,
      errorMessage: 'Invalid availability window id parameter.',
    },
  }),
  availabilityWindowController.getAvailabilityWindowById,
);

availabilityWindowsRouter.patch(
  '/:availabilityWindowId',
  requireAuth,
  loadCurrentStateOfAuthUser,
  validateRequest({
    params: {
      schema: availabilityWindowIdParamsSchema,
      errorMessage: 'Invalid availability window id parameter.',
    },
    body: {
      schema: updateAvailabilityWindowBodySchema,
      errorMessage: 'Invalid availability window update request body.',
    },
  }),
  availabilityWindowController.updateFutureAvailabilityWindow,
);

availabilityWindowsRouter.delete(
  '/:availabilityWindowId/allowed-durations/:allowedDurationId',
  requireAuth,
  loadCurrentStateOfAuthUser,
  validateRequest({
    params: {
      schema: deleteAllowedDurationParamsSchema,
      errorMessage: 'Invalid delete allowed duration parameter.',
    },
  }),
  availabilityWindowController.deleteAllowedDuration,
);

availabilityWindowsRouter.post(
  '/:availabilityWindowId/allowed-durations',
  requireAuth,
  loadCurrentStateOfAuthUser,
  validateRequest({
    params: {
      schema: availabilityWindowIdParamsSchema,
      errorMessage: 'Invalid availability window id parameter.',
    },
    body: {
      schema: bulkAllowedDurationsSchema,
      errorMessage: 'Invalid create allowed durations request body.',
    },
  }),
  availabilityWindowController.createAllowedDurations,
);

availabilityWindowsRouter.delete(
  '/:availabilityWindowId',
  requireAuth,
  loadCurrentStateOfAuthUser,
  validateRequest({
    params: {
      schema: availabilityWindowIdParamsSchema,
      errorMessage: 'Invalid availability window id parameter.',
    },
  }),
  availabilityWindowController.softDeleteAvailabilityWindow,
);

export default availabilityWindowsRouter;
