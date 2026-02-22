import express from 'express';
import cors from 'cors';
import notFound from './middleware/notFound.js';
import logger from './middleware/logger.js';
import errorHandler from './middleware/errorHandler.js';
import router from './routes/system.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(logger);

app.use('/', router);

app.use(notFound);

app.use(errorHandler);

export default app;
