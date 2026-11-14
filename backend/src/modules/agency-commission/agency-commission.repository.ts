import { ROLES } from '@travel-platform/constants';
import { prisma, type Prisma } from '../../config/database';
import { AppError } from '../../utils/app-error';
import { AUDIT_ACTIONS } from '../audit/audit.types';
import { writeAudit } from '../audit/audit.writer';
import { COMMISSION_REQUEST_STATUS } from './agency-commission.types';

const requestInclude = {
  agency: { select: { companyName: true } },
  requestedBy: { select: { fullName: true } },
} as const;

export type CommissionRequestRow = Prisma.AgencyCommissionRequestGetPayload<{ include: typeof requestInclude }>;

const NOT_PENDING = () => AppError.conflict('Yêu cầu chiết khấu đã được xử lý', 'INVALID_STATE_TRANSITION');

export class AgencyCommissionRepository {
  profile(agencyId: string) {
    return prisma.agencyProfile.findUnique({
      where: { id: agencyId },
      select: { companyName: true, commissionRateBps: true, commissionVersion: true },
    });
  }

  findPending(agencyId: string) {
    return prisma.agencyCommissionRequest.findFirst({
      where: { agencyId, status: COMMISSION_REQUEST_STATUS.PENDING },
      include: requestInclude,
    });
  }

  recent(agencyId: string, take = 10) {
    return prisma.agencyCommissionRequest.findMany({
      where: { agencyId },
      orderBy: { createdAt: 'desc' },
      take,
      include: requestInclude,
    });
  }

  async create(input: {
    agencyId: string; requestedByUserId: string; currentShareBps: number;
    requestedShareBps: number; baseVersion: number; reason: string;
  }): Promise<CommissionRequestRow> {
    return prisma.$transaction(async (tx) => {
      const row = await tx.agencyCommissionRequest.create({
        data: { ...input, status: COMMISSION_REQUEST_STATUS.PENDING },
        include: requestInclude,
      });
      await writeAudit(tx, {
        actorId: input.requestedByUserId, actorRole: ROLES.AGENCY,
        action: AUDIT_ACTIONS.AGENCY_COMMISSION_REQUESTED,
        targetType: 'agency', targetId: input.agencyId,
        metadata: { requestId: row.id, currentShareBps: input.currentShareBps, requestedShareBps: input.requestedShareBps, baseVersion: input.baseVersion, reason: input.reason },
      });
      return row;
    });
  }

  async cancel(input: { agencyId: string; id: string; actorUserId: string }): Promise<CommissionRequestRow> {
    return prisma.$transaction(async (tx) => {
      const changed = await tx.agencyCommissionRequest.updateMany({
        where: { id: input.id, agencyId: input.agencyId, status: COMMISSION_REQUEST_STATUS.PENDING },
        data: { status: COMMISSION_REQUEST_STATUS.CANCELLED, cancelledAt: new Date() },
      });
      if (changed.count !== 1) {
        const exists = await tx.agencyCommissionRequest.findFirst({ where: { id: input.id, agencyId: input.agencyId }, select: { status: true } });
        if (!exists) throw AppError.notFound('Commission request not found');
        throw NOT_PENDING();
      }
      const row = await tx.agencyCommissionRequest.findUniqueOrThrow({ where: { id: input.id }, include: requestInclude });
      await writeAudit(tx, {
        actorId: input.actorUserId, actorRole: ROLES.AGENCY,
        action: AUDIT_ACTIONS.AGENCY_COMMISSION_REQUEST_CANCELLED,
        targetType: 'agency', targetId: input.agencyId,
        metadata: { requestId: row.id, requestedShareBps: row.requestedShareBps },
      });
      return row;
    });
  }

  async listAdmin(query: { status?: string; page: number; limit: number }) {
    const where = query.status ? { status: query.status } : {};
    const [items, total] = await prisma.$transaction([
      prisma.agencyCommissionRequest.findMany({
        where, include: requestInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit, take: query.limit,
      }),
      prisma.agencyCommissionRequest.count({ where }),
    ]);
    return { items, total };
  }

  /** Applies the requested share to the agency, only if the rate did not move since the request. */
  async approve(input: { id: string; actorId: string; note?: string }): Promise<CommissionRequestRow> {
    return prisma.$transaction(async (tx) => {
      const row = await tx.agencyCommissionRequest.findUnique({ where: { id: input.id }, include: requestInclude });
      if (!row) throw AppError.notFound('Commission request not found');
      if (row.status !== COMMISSION_REQUEST_STATUS.PENDING) throw NOT_PENDING();

      await tx.$queryRaw`SELECT id FROM "AgencyProfile" WHERE id = ${row.agencyId}::uuid FOR UPDATE`;
      const profile = await tx.agencyProfile.findUniqueOrThrow({
        where: { id: row.agencyId },
        select: { commissionRateBps: true, commissionVersion: true },
      });
      if (profile.commissionVersion !== row.baseVersion) {
        throw AppError.conflict('Mức chiết khấu đã thay đổi kể từ khi gửi yêu cầu. Hãy từ chối và để doanh nghiệp gửi lại.', 'SETTINGS_CONFLICT');
      }

      const platformRateBps = 10_000 - row.requestedShareBps;
      const saved = await tx.agencyProfile.update({
        where: { id: row.agencyId },
        data: { commissionRateBps: platformRateBps, commissionVersion: { increment: 1 } },
        select: { commissionVersion: true },
      });
      const decided = await tx.agencyCommissionRequest.update({
        where: { id: row.id },
        data: {
          status: COMMISSION_REQUEST_STATUS.APPROVED,
          decidedByUserId: input.actorId, decidedAt: new Date(),
          decisionNote: input.note?.trim() || null, appliedVersion: saved.commissionVersion,
        },
        include: requestInclude,
      });
      await writeAudit(tx, {
        actorId: input.actorId, actorRole: ROLES.SUPER_ADMIN,
        action: AUDIT_ACTIONS.AGENCY_COMMISSION_REQUEST_APPROVED,
        targetType: 'agency', targetId: row.agencyId,
        metadata: {
          requestId: row.id,
          before: { shareBps: row.currentShareBps, platformRateBps: 10_000 - row.currentShareBps },
          after: { shareBps: row.requestedShareBps, platformRateBps },
          note: input.note,
        },
      });
      return decided;
    });
  }

  async reject(input: { id: string; actorId: string; note: string }): Promise<CommissionRequestRow> {
    return prisma.$transaction(async (tx) => {
      const changed = await tx.agencyCommissionRequest.updateMany({
        where: { id: input.id, status: COMMISSION_REQUEST_STATUS.PENDING },
        data: {
          status: COMMISSION_REQUEST_STATUS.REJECTED,
          decidedByUserId: input.actorId, decidedAt: new Date(), decisionNote: input.note,
        },
      });
      if (changed.count !== 1) {
        const exists = await tx.agencyCommissionRequest.findUnique({ where: { id: input.id }, select: { status: true } });
        if (!exists) throw AppError.notFound('Commission request not found');
        throw NOT_PENDING();
      }
      const row = await tx.agencyCommissionRequest.findUniqueOrThrow({ where: { id: input.id }, include: requestInclude });
      await writeAudit(tx, {
        actorId: input.actorId, actorRole: ROLES.SUPER_ADMIN,
        action: AUDIT_ACTIONS.AGENCY_COMMISSION_REQUEST_REJECTED,
        targetType: 'agency', targetId: row.agencyId,
        metadata: { requestId: row.id, requestedShareBps: row.requestedShareBps, note: input.note },
      });
      return row;
    });
  }
}

export const agencyCommissionRepository = new AgencyCommissionRepository();
