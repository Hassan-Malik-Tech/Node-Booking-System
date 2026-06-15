import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import notFound from './middleware/notFound.js';
import logger from './middleware/logger.js';
import errorHandler from './middleware/errorHandler.js';
import apiRouter from './routes/apiRouter.js';
import healthRouter from './routes/healthRouter.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(logger);
app.use(express.json());

app.use('/api', apiRouter);
app.use('/health', healthRouter);

app.use(notFound);

app.use(errorHandler);

export default app;
