import type { QueryFilter, SortOrder, UpdateQuery } from 'mongoose';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { ReportModel, type ReportAttributes, type ReportDocument } from './reports.model';
import { REPORT_STATUS, type ListModerationReportsQuery, type ReportStatus, type ReportTarget } from './reports.types';

type Filter = QueryFilter<ReportAttributes>;

export const openReportKey = (reporterId: string, targetType: ReportTarget, targetId: string) => `${reporterId}:${targetType}:${targetId}`;

export class ReportsRepository {
  create(data: Partial<ReportAttributes>): Promise<ReportDocument> {
    return ReportModel.create(data);
  }

  findById(id: string): Promise<ReportDocument | null> {
    return ReportModel.findById(id).exec();
  }

  findOpenDuplicate(reporterId: string, targetType: ReportTarget, targetId: string): Promise<ReportDocument | null> {
    return ReportModel.findOne({ openKey: openReportKey(reporterId, targetType, targetId) }).exec();
  }

  /** Compare-and-set on status so an agency answer and a moderator decision cannot overwrite each other. */
  transition(id: string, expected: readonly ReportStatus[], update: UpdateQuery<ReportAttributes>): Promise<ReportDocument | null> {
    return ReportModel.findOneAndUpdate({ _id: id, status: { $in: expected } }, update, { returnDocument: 'after' }).exec();
  }

  listByReporter(reporterId: string, status: ReportStatus | undefined, page: PageRequest) {
    return this.paginate({ reporterId, ...(status ? { status } : {}) }, { createdAt: -1, _id: -1 }, page);
  }

  listByAgency(agencyId: string, status: ReportStatus | undefined, page: PageRequest) {
    return this.paginate({ agencyId, ...(status ? { status } : {}) }, { createdAt: -1, _id: -1 }, page);
  }

  listForModeration(query: ListModerationReportsQuery) {
    const filter: Filter = {};
    if (query.status) filter.status = query.status;
    if (query.targetType) filter.targetType = query.targetType;
    if (query.category) filter.category = query.category;
    // Open items first (oldest first = FIFO queue), otherwise newest first.
    const sort: Record<string, SortOrder> = query.status === 'OPEN' || query.status === 'AGENCY_RESPONDED' ? { createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 };
    return this.paginate(filter, sort, query);
  }

  /** Reports routed to an agency that it has not answered yet. */
  countOpenForAgency(agencyId: string): Promise<number> {
    return ReportModel.countDocuments({ agencyId, status: REPORT_STATUS.OPEN }).exec();
  }

  countByStatus(): Promise<{ _id: ReportStatus; count: number }[]> {
    return ReportModel.aggregate<{ _id: ReportStatus; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]).exec();
  }

  private async paginate(filter: Filter, sort: Record<string, SortOrder>, page: PageRequest) {
    const [items, total] = await Promise.all([
      ReportModel.find(filter).sort(sort).skip(toSkip(page)).limit(page.limit).exec(),
      ReportModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}

export const reportsRepository = new ReportsRepository();
