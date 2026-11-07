import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@travel-platform/constants';
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../config/database';
import { requirePermission } from '../../middlewares/authorize';
import { validate, validated } from '../../middlewares/validate';
import { sendOk } from '../../utils/api-response';

export const moderationSlaRouter = Router();
const query = z.object({ days: z.coerce.number().pipe(z.union([z.literal(7), z.literal(30)])).default(7) });
moderationSlaRouter.get('/', requirePermission(PERMISSIONS.DISPUTE_RESOLVE), validate({ query }), async (req, res) => {
  const { days } = validated<unknown, z.infer<typeof query>>(req).query;
  const rows = await prisma.$queryRaw<{ day: string; onTime: number; nearOverdue: number; breached: number; unknown: number }[]>(Prisma.sql`
    WITH dates AS (
      SELECT generate_series((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - (${days} - 1),
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, interval '1 day')::date AS day
    ), cases AS (
      SELECT ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
        COALESCE("escalationDeadlineAt", "slaDeadlineAt") AS deadline,
        CASE WHEN status IN ('RESOLVED', 'CLOSED') THEN COALESCE("resolvedAt", "closedAt", CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
          ELSE CURRENT_TIMESTAMP AT TIME ZONE 'UTC' END AS checked,
        status NOT IN ('RESOLVED', 'CLOSED') AS waiting,
        COALESCE("escalationSlaHours", "slaHours", 0) AS hours
      FROM "ComplaintTicket" WHERE "createdAt" >= CURRENT_TIMESTAMP - (${days} + 1) * interval '1 day'
    )
    SELECT d.day::text AS day,
      COUNT(*) FILTER (WHERE c.deadline IS NOT NULL AND c.checked <= c.deadline AND NOT (c.waiting AND c.deadline - c.checked <= c.hours * interval '12 minutes'))::int AS "onTime",
      COUNT(*) FILTER (WHERE c.deadline IS NOT NULL AND c.waiting AND c.checked <= c.deadline AND c.deadline - c.checked <= c.hours * interval '12 minutes')::int AS "nearOverdue",
      COUNT(*) FILTER (WHERE c.deadline IS NOT NULL AND c.checked > c.deadline)::int AS breached,
      COUNT(c.day) FILTER (WHERE c.deadline IS NULL)::int AS unknown
    FROM dates d LEFT JOIN cases c ON c.day = d.day GROUP BY d.day ORDER BY d.day
  `);
  sendOk(res, { generatedAt: new Date().toISOString(), timezone: 'Asia/Ho_Chi_Minh', cohort: 'createdAt', nearOverdueFraction: 0.2, rows });
});
