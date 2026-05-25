import { Router } from 'express';
import authRouter from './authRoutes.js';
import meRouter from './meRoutes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/me', meRouter);

export default apiRouter;
