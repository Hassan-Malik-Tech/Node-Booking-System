import { Router } from 'express';
import * as meController from '../controllers/meController.js';
import requireAuth from '../middleware/requireAuth.js';
import loadCurrentStateOfAuthUser from '../middleware/loadCurrentStateOfAuthUser.js';

const meRouter = Router();

meRouter.use(requireAuth, loadCurrentStateOfAuthUser);

meRouter.get('/', meController.getProfile);

export default meRouter;
