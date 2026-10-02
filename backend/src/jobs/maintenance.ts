import { logger } from '../utils/logger';
import { authService } from '../modules/auth';
import { bookingsService } from '../modules/bookings';
import { notificationsService } from '../modules/notifications';
import { paymentsService } from '../modules/payments';
import { subscriptionsService } from '../modules/subscriptions';

export interface MaintenanceTask {
  name: string;
  intervalMs: number;
  /** Must be idempotent and safe to run on several nodes at once (every task below is a compare-and-set sweep). */
  run: () => Promise<unknown>;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** In-app notifications are kept for six months. */
const NOTIFICATION_RETENTION_DAYS = 180;

/** Every time-driven rule of the platform, in one place. */
export function defaultTasks(): MaintenanceTask[] {
  return [
    // Unpaid bookings free their seats / promotions; finished trips become COMPLETED (reviews, earnings, e-ticket USED).
    { name: 'bookings.expirePending', intervalMs: MINUTE, run: () => bookingsService.expirePendingBookings() },
    { name: 'bookings.completeFinished', intervalMs: 5 * MINUTE, run: () => bookingsService.completeFinishedBookings() },
    // Payment links past their expiry are closed (after asking the gateway); PAID-but-unfulfilled payments are retried.
    { name: 'payments.expireStale', intervalMs: MINUTE, run: () => paymentsService.expireStalePayments() },
    { name: 'payments.retryUnfulfilled', intervalMs: MINUTE, run: () => paymentsService.retryUnfulfilled() },
    { name: 'subscriptions.expireEnded', intervalMs: 5 * MINUTE, run: () => subscriptionsService.expireEndedSubscriptions() },
    { name: 'subscriptions.cancelAbandoned', intervalMs: 5 * MINUTE, run: () => subscriptionsService.cancelAbandonedSubscriptions() },
    // PostgreSQL has no TTL indexes: expired one-time codes / refresh tokens and old notifications are deleted here.
    { name: 'auth.purgeExpired', intervalMs: HOUR, run: () => authService.purgeExpiredCredentials() },
    { name: 'notifications.purgeOld', intervalMs: 6 * HOUR, run: () => notificationsService.purgeOlderThan(NOTIFICATION_RETENTION_DAYS) },
  ];
}

/**
 * Starts the periodic sweeps and returns a function that stops them.
 *  - A task never overlaps with itself (a slow run delays the next one instead of piling up).
 *  - A failing run is logged and retried on the next tick; it never crashes the process.
 *  - Timers are `unref`'d so they cannot keep the process alive on shutdown.
 */
export function startMaintenanceJobs(tasks: MaintenanceTask[] = defaultTasks()): () => void {
  const timers = tasks.map((task) => {
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const result = await task.run();
        if (typeof result === 'number' && result > 0) logger.info(`[job] ${task.name}: ${result} item(s) processed`);
      } catch (error) {
        logger.error(`[job] ${task.name} failed`, { message: (error as Error).message });
      } finally {
        running = false;
      }
    };
    const timer = setInterval(() => void tick(), task.intervalMs);
    timer.unref();
    return timer;
  });
  logger.info(`Maintenance jobs started (${tasks.length} tasks)`);
  return () => timers.forEach((timer) => clearInterval(timer));
}
