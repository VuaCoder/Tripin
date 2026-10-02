import { nullIfNotFound, prisma, type Prisma } from '../../config/database';
import type { Report } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { REPORT_STATUS, type ListModerationReportsQuery, type ReportStatus, type ReportTarget } from './reports.types';

export const openReportKey = (reporterId: string, targetType: ReportTarget, targetId: string) => `${reporterId}:${targetType}:${targetId}`;

export interface AgencyResponse {
  text: string;
  respondedAt: Date;
  by: string;
}

export interface Resolution {
  decision: 'RESOLVED' | 'REJECTED';
  note: string;
  by: string;
  resolvedAt: Date;
}

type FlattenedColumns =
  | 'agencyResponseText' | 'agencyResponseAt' | 'agencyResponseById'
  | 'resolutionDecision' | 'resolutionNote' | 'resolutionById' | 'resolvedAt';

/** A stored report; the agency's answer and the moderator's decision are exposed as nested objects. */
export type ReportRecord = Omit<Report, FlattenedColumns> & { agencyResponse?: AgencyResponse; resolution?: Resolution };

export type NewReport = Pick<Report, 'reporterId' | 'targetType' | 'targetId' | 'category' | 'description'> &
  Partial<Pick<Report, 'bookingId' | 'agencyId' | 'tourId' | 'openKey'>>;

/** Changes to a report; `openKey: null` releases the one-open-report-per-target guard. */
export interface ReportPatch {
  status?: ReportStatus;
  openKey?: string | null;
  agencyResponse?: AgencyResponse;
  resolution?: Resolution;
}

function toRecord(row: Report): ReportRecord {
  const { agencyResponseText, agencyResponseAt, agencyResponseById, resolutionDecision, resolutionNote, resolutionById, resolvedAt, ...rest } = row;
  return {
    ...rest,
    agencyResponse:
      agencyResponseText && agencyResponseAt && agencyResponseById
        ? { text: agencyResponseText, respondedAt: agencyResponseAt, by: agencyResponseById }
        : undefined,
    resolution:
      resolutionDecision && resolutionNote && resolutionById && resolvedAt
        ? { decision: resolutionDecision as Resolution['decision'], note: resolutionNote, by: resolutionById, resolvedAt }
        : undefined,
  };
}

function toData(patch: ReportPatch): Prisma.ReportUncheckedUpdateInput {
  const { agencyResponse, resolution, ...scalars } = patch;
  return {
    ...scalars,
    ...(agencyResponse
      ? { agencyResponseText: agencyResponse.text, agencyResponseAt: agencyResponse.respondedAt, agencyResponseById: agencyResponse.by }
      : {}),
    ...(resolution
      ? { resolutionDecision: resolution.decision, resolutionNote: resolution.note, resolutionById: resolution.by, resolvedAt: resolution.resolvedAt }
      : {}),
  };
}

const NEWEST_FIRST: Prisma.ReportOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];

export class ReportsRepository {
  async create(data: NewReport): Promise<ReportRecord> {
    return toRecord(await prisma.report.create({ data }));
  }

  async findById(id: string): Promise<ReportRecord | null> {
    const row = await prisma.report.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async findOpenDuplicate(reporterId: string, targetType: ReportTarget, targetId: string): Promise<ReportRecord | null> {
    const row = await prisma.report.findUnique({ where: { openKey: openReportKey(reporterId, targetType, targetId) } });
    return row ? toRecord(row) : null;
  }

  /** Compare-and-set on status so an agency answer and a moderator decision cannot overwrite each other. */
  async transition(id: string, expected: readonly ReportStatus[], patch: ReportPatch): Promise<ReportRecord | null> {
    const row = await prisma.report.update({ where: { id, status: { in: [...expected] } }, data: toData(patch) }).catch(nullIfNotFound);
    return row ? toRecord(row) : null;
  }

  listByReporter(reporterId: string, status: ReportStatus | undefined, page: PageRequest) {
    return this.paginate({ reporterId, ...(status ? { status } : {}) }, NEWEST_FIRST, page);
  }

  listByAgency(agencyId: string, status: ReportStatus | undefined, page: PageRequest) {
    return this.paginate({ agencyId, ...(status ? { status } : {}) }, NEWEST_FIRST, page);
  }

  listForModeration(query: ListModerationReportsQuery) {
    const where: Prisma.ReportWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.targetType) where.targetType = query.targetType;
    if (query.category) where.category = query.category;
    // Open items first (oldest first = FIFO queue), otherwise newest first.
    const fifo = query.status === 'OPEN' || query.status === 'AGENCY_RESPONDED';
    return this.paginate(where, fifo ? [{ createdAt: 'asc' }, { id: 'asc' }] : NEWEST_FIRST, query);
  }

  /** Reports routed to an agency that it has not answered yet. */
  countOpenForAgency(agencyId: string): Promise<number> {
    return prisma.report.count({ where: { agencyId, status: REPORT_STATUS.OPEN } });
  }

  async countByStatus(): Promise<{ status: ReportStatus; count: number }[]> {
    const rows = await prisma.report.groupBy({ by: ['status'], _count: { _all: true } });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  }

  private async paginate(where: Prisma.ReportWhereInput, orderBy: Prisma.ReportOrderByWithRelationInput[], page: PageRequest) {
    const [rows, total] = await Promise.all([
      prisma.report.findMany({ where, orderBy, skip: toSkip(page), take: page.limit }),
      prisma.report.count({ where }),
    ]);
    return { items: rows.map(toRecord), total };
  }
}

export const reportsRepository = new ReportsRepository();
