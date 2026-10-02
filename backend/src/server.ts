import http from 'node:http';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { startMaintenanceJobs } from './jobs/maintenance';
import { attachChatGateway } from './modules/chat';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  // Created explicitly (instead of app.listen) so Socket.IO can attach to the same HTTP server (chat module).
  const server = http.createServer(app);
  const io = attachChatGateway(server); // realtime chat + live notifications (Socket.IO on the same port)

  const stopJobs = env.JOBS_ENABLED ? startMaintenanceJobs() : () => undefined;

  server.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    stopJobs();
    void io.close();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
