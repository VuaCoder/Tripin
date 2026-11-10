import type { DbExecutor } from '../../config/database';

/** Shared transaction lock: all schedule writers acquire it before mutating tour/departure/assignment rows. */
export async function lockGuideSchedules(tx: DbExecutor): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(707002)`;
}

export async function assertGuideAvailability(_tx: DbExecutor, _tourId: string, _guideId?: string, _departureId?: string): Promise<void> {
  // Tour guide role is completely retired / removed; no availability conflict checks needed.
  return;
}
