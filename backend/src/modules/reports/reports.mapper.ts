import { maskName } from '../reviews';
import type { ReportRecord } from './reports.repository';
import type {
  ComplaintDto,
  ModerationReportDto,
  MyReportDto,
  ReportCategory,
  ReportStatus,
  ReportTarget,
} from './reports.types';

function base(report: ReportRecord): MyReportDto {
  return {
    id: report.id,
    targetType: report.targetType as ReportTarget,
    targetId: report.targetId,
    category: report.category as ReportCategory,
    description: report.description,
    status: report.status as ReportStatus,
    bookingId: report.bookingId ? report.bookingId : undefined,
    agencyResponse: report.agencyResponse
      ? { text: report.agencyResponse.text, respondedAt: report.agencyResponse.respondedAt.toISOString() }
      : undefined,
    resolution: report.resolution
      ? {
          decision: report.resolution.decision as 'RESOLVED' | 'REJECTED',
          note: report.resolution.note,
          resolvedAt: report.resolution.resolvedAt.toISOString(),
        }
      : undefined,
    createdAt: report.createdAt.toISOString(),
  };
}

export const toMyReportDto = base;

export function toComplaintDto(report: ReportRecord, reporterFullName?: string): ComplaintDto {
  return { ...base(report), tourId: report.tourId ? report.tourId : undefined, reporterName: maskName(reporterFullName) };
}

/** What a report resolves to for display: names instead of ids, plus the review being judged when there is one. */
export type ReportExtras = Pick<
  ModerationReportDto,
  'reporterName' | 'targetName' | 'agencyName' | 'tourTitle' | 'bookingCode' | 'review' | 'relatedTicket' | 'directChat'
>;

export function toModerationReportDto(report: ReportRecord, extras: ReportExtras = {}): ModerationReportDto {
  return {
    ...base(report),
    reporterId: report.reporterId,
    agencyId: report.agencyId ? report.agencyId : undefined,
    tourId: report.tourId ? report.tourId : undefined,
    ...extras,
  };
}
