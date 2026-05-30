import { Router } from 'express';
import * as resourceController from '../controllers/resourceController.js';
import validateRequest from '../middleware/validateRequest.js';
import {
  listActiveResourcesQuerySchema,
  getActiveResourceByIdParamsSchema,
} from '../validators/resourceSchemas.js';

const resourceRouter = Router();

resourceRouter.get(
  '/',
  validateRequest({
    query: {
      schema: listActiveResourcesQuerySchema,
      errorMessage: 'Invalid resource list query.',
    },
  }),
  resourceController.listActiveResources,
);
resourceRouter.get(
  '/:resourceId',
  validateRequest({
    params: {
      schema: getActiveResourceByIdParamsSchema,
      errorMessage: 'Invalid resource id parameter.',
    },
  }),
  resourceController.getActiveResourceById,
);

export default resourceRouter;
