import { Router } from 'express';
import * as meController from '../controllers/meController.js';
import requireAuth from '../middleware/requireAuth.js';
import validateRequest from '../middleware/validateRequest.js';
import loadCurrentStateOfAuthUser from '../middleware/loadCurrentStateOfAuthUser.js';
import {
  updateUserBodySchema,
  updatePasswordBodySchema,
} from '../validators/userSchemas.js';

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
