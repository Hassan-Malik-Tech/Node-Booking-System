import { Router } from 'express';
import authRouter from './authRoutes.js';
import meRouter from './meRoutes.js';
import resourceRouter from './resourceRoutes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/me', meRouter);
apiRouter.use('/resources', resourceRouter);

export default apiRouter;
