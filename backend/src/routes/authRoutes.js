import { Router } from 'express';
import { registrationSchema, loginSchema } from '../validators/authSchemas.js';
import validateRequest from '../middleware/validateRequest.js';
import authRateLimit from '../middleware/authRateLimit.js';
import * as authController from '../controllers/authController.js';

const authRouter = Router();

// Applies to all auth routes and must be registered before route handlers (so that authRateLimit is the first middleware that runs).
authRouter.use(authRateLimit);

authRouter.post(
  '/register',
  validateRequest({
    body: {
      schema: registrationSchema,
      errorMessage: 'Invalid registration request body.',
    },
  }),
  authController.registerUser,
);

authRouter.post(
  '/login',
  validateRequest({
    body: {
      schema: loginSchema,
      errorMessage: 'Invalid login request body.',
    },
  }),
  authController.loginUser,
);

export default authRouter;
