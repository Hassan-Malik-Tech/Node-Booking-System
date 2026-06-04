import { Router } from 'express';
import * as resourceController from '../controllers/resourceController.js';
import * as availabilityWindowController from '../controllers/availabilityWindowController.js';
import validateRequest from '../middleware/validateRequest.js';
import {
  listActiveResourcesQuerySchema,
  resourceByIdParamsSchema,
} from '../validators/resourceSchemas.js';
import {
  createAvailabilityWindowBodySchema,
  createAvailabilityWindowsBodySchema,
} from '../validators/availabilityWindowSchemas.js';
import requireAuth from '../middleware/requireAuth.js';
import loadCurrentStateOfAuthUser from '../middleware/loadCurrentStateOfAuthUser.js';

const resourcesRouter = Router();

resourcesRouter.get(
  '/',
  validateRequest({
    query: {
      schema: listActiveResourcesQuerySchema,
      errorMessage: 'Invalid resource list query.',
    },
  }),
  resourceController.listActiveResources,
);
resourcesRouter.get(
  '/:resourceId',
  validateRequest({
    params: {
      schema: resourceByIdParamsSchema,
      errorMessage: 'Invalid resource id parameter.',
    },
  }),
  resourceController.getActiveResourceById,
);

resourcesRouter.post(
  '/:resourceId/availability-windows',
  requireAuth,
  loadCurrentStateOfAuthUser,
  validateRequest({
    params: {
      schema: resourceByIdParamsSchema,
      errorMessage: 'Invalid resource id parameter.',
    },
    body: {
      schema: createAvailabilityWindowBodySchema,
      errorMessage: 'Invalid availability window create request body.',
    },
  }),
  availabilityWindowController.createAvailabilityWindow,
);

resourcesRouter.post(
  '/:resourceId/availability-windows/bulk',
  requireAuth,
  loadCurrentStateOfAuthUser,
  validateRequest({
    params: {
      schema: resourceByIdParamsSchema,
      errorMessage: 'Invalid resource id parameter.',
    },
    body: {
      schema: createAvailabilityWindowsBodySchema,
      errorMessage: 'Invalid availability window bulk create request body.',
    },
  }),
  availabilityWindowController.createAvailabilityWindowsInBulk,
);

export default resourcesRouter;
