import type { PersistedRole } from '@travel-platform/constants';
import { isUniqueViolation } from '../../config/database';
import { AppError } from '../../utils/app-error';
import { buildPage, type Page } from '../../utils/pagination';
import { NOTIFICATION_TYPE, notificationsService } from '../notifications';
import { systemSettingsService } from '../system-settings';
import {
  agencyCommissionRepository,
  type AgencyCommissionRepository,
  type CommissionRequestRow,
} from './agency-commission.repository';
import {
  COMMISSION_REQUEST_STATUS,
  type AgencyCommissionOverviewDto,
  type AgencyCommissionRequestDto,
  type CommissionRequestStatus,
  type ListCommissionRequestsQuery,
} from './agency-commission.types';
import type { CreateCommissionRequestBody } from './agency-commission.validation';

type Actor = { userId: string; role: PersistedRole };
type Settings = Pick<typeof systemSettingsService, 'getCommissionBps'>;
type Notifications = Pick<typeof notificationsService, 'notifyAdmins' | 'notifyAgency'>;

export class AgencyCommissionService {
  constructor(
    private readonly repo: AgencyCommissionRepository = agencyCommissionRepository,
    private readonly settings: Settings = systemSettingsService,
    private readonly notifications: Notifications = notificationsService,
  ) {}

  /** The rate the agency keeps today, the platform default, and its open/history requests. */
  async overview(agencyId: string): Promise<AgencyCommissionOverviewDto> {
    const [profile, platformBps, defaultBps, pending, recent] = await Promise.all([
      this.repo.profile(agencyId),
      this.settings.getCommissionBps(agencyId),
      this.settings.getCommissionBps(),
      this.repo.findPending(agencyId),
      this.repo.recent(agencyId),
    ]);
    if (!profile) throw AppError.notFound('Agency not found');
    const override = profile.commissionRateBps;
    return {
      effectiveShareBps: 10_000 - platformBps,
      effectiveSharePercent: (10_000 - platformBps) / 100,
      defaultShareBps: 10_000 - defaultBps,
      defaultSharePercent: (10_000 - defaultBps) / 100,
      overrideShareBps: override === null ? null : 10_000 - override,
      overrideSharePercent: override === null ? null : (10_000 - override) / 100,
      commissionVersion: profile.commissionVersion,
      pendingRequest: pending ? this.toDto(pending) : null,
      recentRequests: recent.map((row) => this.toDto(row)),
    };
  }

  async create(ctx: { agencyId: string; actorUserId: string }, input: CreateCommissionRequestBody): Promise<AgencyCommissionRequestDto> {
    const profile = await this.repo.profile(ctx.agencyId);
    if (!profile) throw AppError.notFound('Agency not found');
    const platformBps = await this.settings.getCommissionBps(ctx.agencyId);
    try {
      const row = await this.repo.create({
        agencyId: ctx.agencyId,
        requestedByUserId: ctx.actorUserId,
        currentShareBps: 10_000 - platformBps,
        requestedShareBps: Math.round(input.requestedSharePercent * 100),
        baseVersion: profile.commissionVersion,
        reason: input.reason,
      });
      await this.notifications.notifyAdmins({
        type: NOTIFICATION_TYPE.ADMIN_REQUEST_RECEIVED,
        title: 'Yêu cầu điều chỉnh chiết khấu',
        body: `${profile.companyName?.trim() || 'Doanh nghiệp'} đề nghị mức ${row.requestedShareBps / 100}% doanh nghiệp hưởng.`,
        data: { requestId: row.id },
      });
      return this.toDto(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw AppError.conflict('Đã có yêu cầu chiết khấu đang chờ duyệt');
      throw error;
    }
  }

  async cancel(agencyId: string, actorUserId: string, id: string): Promise<AgencyCommissionRequestDto> {
    return this.toDto(await this.repo.cancel({ agencyId, id, actorUserId }));
  }

  async listAdmin(query: ListCommissionRequestsQuery): Promise<Page<AgencyCommissionRequestDto>> {
    const { items, total } = await this.repo.listAdmin(query);
    return buildPage(items.map((row) => this.toDto(row)), total, query);
  }

  async approve(actor: Actor, id: string, note?: string): Promise<AgencyCommissionRequestDto> {
    const row = await this.repo.approve({ id, actorId: actor.userId, note });
    const dto = this.toDto(row);
    await this.notifications.notifyAgency(row.agencyId, {
      type: NOTIFICATION_TYPE.AGENCY_COMMISSION_DECIDED,
      title: 'Yêu cầu chiết khấu đã được duyệt',
      body: `Mức ${dto.requestedSharePercent}% doanh nghiệp hưởng áp dụng cho các booking tạo sau thời điểm này.`,
      data: { requestId: row.id, status: COMMISSION_REQUEST_STATUS.APPROVED },
    });
    return dto;
  }

  async reject(actor: Actor, id: string, note: string): Promise<AgencyCommissionRequestDto> {
    const row = await this.repo.reject({ id, actorId: actor.userId, note });
    const dto = this.toDto(row);
    await this.notifications.notifyAgency(row.agencyId, {
      type: NOTIFICATION_TYPE.AGENCY_COMMISSION_DECIDED,
      title: 'Yêu cầu chiết khấu bị từ chối',
      body: `Yêu cầu mức ${dto.requestedSharePercent}% bị từ chối. Lý do: ${note}`,
      data: { requestId: row.id, status: COMMISSION_REQUEST_STATUS.REJECTED },
    });
    return dto;
  }

  private toDto(row: CommissionRequestRow): AgencyCommissionRequestDto {
    return {
      id: row.id,
      agencyId: row.agencyId,
      agencyName: row.agency.companyName?.trim() || undefined,
      requestedByName: row.requestedBy.fullName,
      currentShareBps: row.currentShareBps,
      currentSharePercent: row.currentShareBps / 100,
      requestedShareBps: row.requestedShareBps,
      requestedSharePercent: row.requestedShareBps / 100,
      baseVersion: row.baseVersion,
      reason: row.reason,
      status: row.status as CommissionRequestStatus,
      decisionNote: row.decisionNote,
      appliedVersion: row.appliedVersion,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

export const agencyCommissionService = new AgencyCommissionService();
