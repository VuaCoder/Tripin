import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@travel-platform/constants';
import { prisma } from '../../config/database';
import { requirePermission, requireSuperAdmin, userActor } from '../../middlewares/authorize';
import { validate, validated } from '../../middlewares/validate';
import { writeAudit, redactAudit } from './audit.writer';

export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
const query = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional(), action: z.string().max(100).optional() })
  .refine((v) => !v.from || !v.to || v.from <= v.to, 'Invalid date range');
export const auditExportRouter = Router();
auditExportRouter.use(requireSuperAdmin, requirePermission(PERMISSIONS.AUDIT_LOG_VIEW));
for (const resource of ['audit-logs', 'moderation'] as const) {
  auditExportRouter.get(`/${resource}`, validate({ query }), async (req, res) => {
    const filter = validated<unknown, z.infer<typeof query>>(req).query;
    const cutoff = new Date();
    const actor = userActor(req);
    await writeAudit(prisma, { actorId: actor.userId, actorRole: actor.role, action: 'audit.exported', targetType: resource, metadata: { filter, cutoff } });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${resource}-${cutoff.toISOString().slice(0, 10)}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    const writeRow = async (values: unknown[]) => {
      if (res.destroyed) return;
      if (!res.write(values.map(csvCell).join(',') + '\r\n')) {
        await new Promise<void>((resolve) => { const done = () => { res.off('drain', done); res.off('close', done); resolve(); }; res.once('drain', done); res.once('close', done); });
      }
    };
    res.write('\uFEFF');
    if (resource === 'moderation') {
      await writeRow(['id', 'targetType', 'targetId', 'category', 'status', 'description', 'resolutionNote', 'createdAt', 'resolvedAt']);
      let reportCursor: string | undefined;
      while (!res.destroyed) {
        const rows = await prisma.report.findMany({ where: { createdAt: { ...(filter.from ? { gte: filter.from } : {}), lte: filter.to && filter.to < cutoff ? filter.to : cutoff } },
          orderBy: { id: 'asc' }, take: 500, ...(reportCursor ? { cursor: { id: reportCursor }, skip: 1 } : {}) });
        if (!rows.length) break;
        for (const row of rows) await writeRow([row.id, row.targetType, row.targetId, row.category, row.status, row.description, row.resolutionNote, row.createdAt, row.resolvedAt]);
        reportCursor = rows.at(-1)!.id;
      }
      if (!res.destroyed) res.end();
      return;
    }
    await writeRow(['id', 'actorId', 'action', 'targetType', 'targetId', 'metadata', 'createdAt']);
    let cursor: string | undefined;
    while (!res.destroyed) {
      const rows = await prisma.auditLog.findMany({ where: {
        createdAt: { ...(filter.from ? { gte: filter.from } : {}), lte: filter.to && filter.to < cutoff ? filter.to : cutoff },
        ...(filter.action ? { action: filter.action } : {}),
      }, orderBy: { id: 'asc' }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
      if (!rows.length) break;
      for (const row of rows) {
        if (res.destroyed) break;
        await writeRow([row.id, row.actorId, row.action, row.targetType, row.targetId, redactAudit(row.metadata), row.createdAt]);
      }
      cursor = rows.at(-1)!.id;
    }
    if (!res.destroyed) res.end();
  });
}
