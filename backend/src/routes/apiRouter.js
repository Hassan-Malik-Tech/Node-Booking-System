import { Router } from 'express';
import authRouter from './authRoutes.js';
import meRouter from './meRoutes.js';
import resourcesRouter from './resourceRoutes.js';
import availabilityWindowsRouter from './availabilityWindowRoutes.js';
import reservationsRouter from './reservationRoutes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/me', meRouter);
apiRouter.use('/resources', resourcesRouter);
apiRouter.use('/availability-windows', availabilityWindowsRouter);
apiRouter.use('/reservations', reservationsRouter);

export default apiRouter;
