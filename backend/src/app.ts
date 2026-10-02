import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env, isProduction } from './config/env';
import { authenticate } from './middlewares/authenticate';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { apiRouter } from './routes';

export const API_PREFIX = '/api/v1';

/** Builds the Express app. No listening/DB here so it can be imported by tests. */
export function createApp(): Express {
  const app = express();

  if (isProduction) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL.split(',').map((origin) => origin.trim()), credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', message: 'Backend is healthy' });
  });

  app.use(authenticate); // sets req.actor (GUEST or user) for every request
  app.use(API_PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export default createApp;
