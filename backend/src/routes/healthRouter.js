import { Router } from 'express';
import * as db from '../db/db.js';

const healthRouter = Router();

healthRouter.get('/', async (req, res, next) => {
  try {
    await db.query('SELECT 1');

    return res.json({ status: 'ok' });
  } catch (error) {
    return next(error);
  }
});

export default healthRouter;
 