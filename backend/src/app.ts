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

  const allowedOrigins = env.CLIENT_URL.split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  /** A real loopback origin (dev). Compared by hostname, so `http://localhost.evil.example` is NOT local. */
  const isLoopbackOrigin = (origin: string): boolean => {
    try {
      const url = new URL(origin);
      return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
    } catch {
      return false;
    }
  };

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/$/, '');
        if (
          allowedOrigins.includes(cleanOrigin) ||
          cleanOrigin.endsWith('.vercel.app') ||
          isLoopbackOrigin(cleanOrigin)
        ) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    })
  );

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
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
