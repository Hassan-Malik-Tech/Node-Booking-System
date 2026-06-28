import { Router } from 'express';
import * as resourceController from '../controllers/resourceController.js';
import * as availabilityWindowController from '../controllers/availabilityWindowController.js';
import validateRequest from '../middleware/validateRequest.js';
import {
  listActiveResourcesQuerySchema,
  resourceByIdParamsSchema,
  createResourceBodySchema,
  updateResourceBodySchema,
  listResourcesForStaffQuerySchema,
} from '../validators/resourceSchemas.js';
import {
  createAvailabilityWindowBodySchema,
  createAvailabilityWindowsBodySchema,
  listActiveAvailabilityWindowsByResourceIdQuerySchema,
  getActiveAvailabilityWindowByResourceIdAndWindowIdParamsSchema,
} from '../validators/availabilityWindowSchemas.js';
import requireAuth from '../middleware/requireAuth.js';
import loadCurrentStateOfAuthUser from '../middleware/loadCurrentStateOfAuthUser.js';
import requireRole from '../middleware/requireRole.js';

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

resourcesRouter.post(
  '/',
  requireAuth,
  loadCurrentStateOfAuthUser,
  validateRequest({
    body: {
      schema: createResourceBodySchema,
      errorMessage: 'Invalid resource create request body.',
    },
  }),
  resourceController.createResource,
);

resourcesRouter.get(
  '/manage',
  requireAuth,
  loadCurrentStateOfAuthUser,
  requireRole(['employee', 'admin']),
  validateRequest({
    query: {
      schema: listResourcesForStaffQuerySchema,
      errorMessage: 'Invalid resource management list query.',
    },
  }),
  resourceController.listResourcesForStaff,
);

resourcesRouter.get(
  '/manage/:resourceId',
  requireAuth,
  loadCurrentStateOfAuthUser,
  requireRole(['employee', 'admin']),
  validateRequest({
    params: {
      schema: resourceByIdParamsSchema,
      errorMessage: 'Invalid resource id parameter.',
    },
  }),
  resourceController.getResourceByIdForStaff,
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

resourcesRouter.patch(
  '/:resourceId',
  requireAuth,
  loadCurrentStateOfAuthUser,
  validateRequest({
    params: {
      schema: resourceByIdParamsSchema,
      errorMessage: 'Invalid resource id parameter.',
    },
    body: {
      schema: updateResourceBodySchema,
      errorMessage: 'Invalid resource update request body.',
    },
  }),
  resourceController.updateResource,
);

resourcesRouter.delete(
  '/:resourceId',
  requireAuth,
  loadCurrentStateOfAuthUser,
  validateRequest({
    params: {
      schema: resourceByIdParamsSchema,
      errorMessage: 'Invalid resource id parameter.',
    },
  }),
  resourceController.softDeleteResource,
);

resourcesRouter.patch(
  '/:resourceId/activate',
  requireAuth,
  loadCurrentStateOfAuthUser,
  validateRequest({
    params: {
      schema: resourceByIdParamsSchema,
      errorMessage: 'Invalid resource id parameter.',
    },
    body: {
      schema: createAvailabilityWindowsBodySchema,
      errorMessage: 'Invalid resource activation request body.',
    },
  }),
  resourceController.activateResource,
);

resourcesRouter.patch(
  '/:resourceId/deactivate',
  requireAuth,
  loadCurrentStateOfAuthUser,
  validateRequest({
    params: {
      schema: resourceByIdParamsSchema,
      errorMessage: 'Invalid resource id parameter.',
    },
  }),
  resourceController.deactivateResource,
);

resourcesRouter.get(
  '/:resourceId/availability-windows',
  validateRequest({
    params: {
      schema: resourceByIdParamsSchema,
      errorMessage: 'Invalid resource id parameter.',
    },
    query: {
      schema: listActiveAvailabilityWindowsByResourceIdQuerySchema,
      errorMessage: 'Invalid availability window list query.',
    },
  }),
  availabilityWindowController.listActiveAvailabilityWindowsByResourceId,
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

resourcesRouter.get(
  '/:resourceId/availability-windows/:availabilityWindowId',
  validateRequest({
    params: {
      schema: getActiveAvailabilityWindowByResourceIdAndWindowIdParamsSchema,
      errorMessage: 'Invalid availability window lookup parameter.',
    },
  }),
  availabilityWindowController.getActiveAvailabilityWindowByResourceIdAndWindowId,
);

export default resourcesRouter;
