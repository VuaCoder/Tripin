import type { DbExecutor } from '../../config/database';
import { AppError } from '../../utils/app-error';

/** Shared transaction lock: all schedule writers acquire it before mutating tour/departure/assignment rows. */
export async function lockGuideSchedules(tx: DbExecutor): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(707002)`;
}

export async function assertGuideAvailability(tx: DbExecutor, tourId: string, guideId?: string, departureId?: string): Promise<void> {
  const conflicts = await tx.$queryRaw<{ id: string }[]>`
    SELECT d."id" FROM "TourDeparture" d
    JOIN "Tour" t ON t."id" = d."tourId"
    LEFT JOIN "TourGuideAssignment" a ON a."tourId" = t."id"
    JOIN "TourGuideAssignment" oa ON oa."guideId" = COALESCE(${guideId ?? null}::uuid, a."guideId") AND oa."status" = 'ACCEPTED'
    JOIN "Tour" ot ON ot."id" = oa."tourId"
    JOIN "TourDeparture" od ON od."tourId" = ot."id" AND od."id" <> d."id"
    WHERE t."id" = ${tourId}::uuid
      AND (${departureId ?? null}::uuid IS NULL OR d."id" = ${departureId ?? null}::uuid)
      AND (${guideId ?? null}::uuid IS NOT NULL OR a."status" IN ('PENDING', 'ACCEPTED'))
      AND t."status" <> 'ARCHIVED' AND ot."status" <> 'ARCHIVED'
      AND (d."isOpen" OR d."remaining" < d."capacity") AND (od."isOpen" OR od."remaining" < od."capacity")
      AND d."date" + t."durationDays" * INTERVAL '1 day' > NOW()
      AND od."date" + ot."durationDays" * INTERVAL '1 day' > NOW()
      AND d."date" < od."date" + ot."durationDays" * INTERVAL '1 day'
      AND od."date" < d."date" + t."durationDays" * INTERVAL '1 day'
    LIMIT 1`;
  if (conflicts.length) throw AppError.conflict('Hướng dẫn viên đã có lịch trong thời gian này', 'GUIDE_SCHEDULE_CONFLICT');
}
