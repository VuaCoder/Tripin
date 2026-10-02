import { maskName } from '../reviews';
import type { ReportDocument } from './reports.model';
import type {
  ComplaintDto,
  ModerationReportDto,
  MyReportDto,
  ReportCategory,
  ReportStatus,
  ReportTarget,
} from './reports.types';

function base(report: ReportDocument): MyReportDto {
  return {
    id: report.id,
    targetType: report.targetType as ReportTarget,
    targetId: String(report.targetId),
    category: report.category as ReportCategory,
    description: report.description,
    status: report.status as ReportStatus,
    bookingId: report.bookingId ? String(report.bookingId) : undefined,
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
    createdAt: (report as unknown as { createdAt: Date }).createdAt.toISOString(),
  };
}

export const toMyReportDto = base;

export function toComplaintDto(report: ReportDocument, reporterFullName?: string): ComplaintDto {
  return { ...base(report), tourId: report.tourId ? String(report.tourId) : undefined, reporterName: maskName(reporterFullName) };
}

export function toModerationReportDto(report: ReportDocument): ModerationReportDto {
  return {
    ...base(report),
    reporterId: String(report.reporterId),
    agencyId: report.agencyId ? String(report.agencyId) : undefined,
    tourId: report.tourId ? String(report.tourId) : undefined,
  };
}
