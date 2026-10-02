import {
  AGENCY_VERIFICATION_STATUS,
  ROLES,
  USER_STATUS,
  isPermission,
  type PersistedRole,
} from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import { AUDIT_ACTIONS, auditService, type AuditService } from '../audit';
import { buildPage, type Page } from '../../utils/pagination';
import { assertTransition } from '../../utils/state-machine';
import { toPrivateUserDto, toPublicAgencyDto, toPublicGuideDto } from './users.mapper';
import { usersRepository, type UserPatch, type UserRecord, type UsersRepository } from './users.repository';
import {
  AGENCY_VERIFICATION_TRANSITIONS,
  USER_STATUS_TRANSITIONS,
  type AssignAccessInput,
  type ListUsersQuery,
  type PrivateUserDto,
  type PublicAgencyDto,
  type PublicGuideDto,
  type UpdateProfileInput,
} from './users.types';

export interface UserSummary {
  id: string;
  fullName: string;
  avatarUrl?: string;
  role: PersistedRole;
}

type UsersRepo = Pick<
  UsersRepository,
  'findById' | 'findManyByIds' | 'updateById' | 'updateStatusIf' | 'updateAgencyVerificationIf' | 'count' | 'list' | 'countGroupedBy' | 'countCreatedSince' | 'countAgenciesByVerification'
>;

const STAFF = new Set<PersistedRole>([ROLES.MODERATOR, ROLES.SUPER_ADMIN]);

export class UsersService {
  constructor(
    private readonly users: UsersRepo = usersRepository,
    private readonly audit: Pick<AuditService, 'record'> = auditService,
  ) {}

  // ------------------------------------------------------- Own profile

  /** Use case "View profile" (Traveler / Agency / Tour guide). */
  async getMe(userId: string): Promise<PrivateUserDto> {
    return toPrivateUserDto(await this.requireUser(userId));
  }

  /** Use cases "Update profile informations" / "Update Profile". Role-specific sections are only accepted for that role. */
  async updateMe(userId: string, input: UpdateProfileInput): Promise<PrivateUserDto> {
    const user = await this.requireUser(userId);

    if (input.agencyProfile && user.role !== ROLES.AGENCY) {
      throw AppError.forbidden('Only agencies can edit an agency profile');
    }
    if (input.guideProfile && user.role !== ROLES.TOUR_GUIDE) {
      throw AppError.forbidden('Only tour guides can edit a guide profile');
    }

    const patch: UserPatch = {};
    if (input.fullName !== undefined) patch.fullName = input.fullName;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.avatarUrl !== undefined) patch.avatarUrl = input.avatarUrl;
    const agencyFields = definedEntries(input.agencyProfile);
    if (agencyFields) patch.agencyProfile = agencyFields;
    const guideFields = definedEntries(input.guideProfile);
    if (guideFields) patch.guideProfile = guideFields;
    if (Object.keys(patch).length === 0) return toPrivateUserDto(user);

    const updated = await this.users.updateById(userId, patch);
    return toPrivateUserDto(updated ?? user);
  }

  /** Agency asks moderators to verify its profile (UNVERIFIED/REJECTED -> PENDING). */
  async requestAgencyVerification(userId: string): Promise<PrivateUserDto> {
    const user = await this.requireUser(userId);
    if (user.role !== ROLES.AGENCY) throw AppError.forbidden('Only agencies can request verification');

    const profile = user.agencyProfile;
    if (!profile?.companyName || !profile.licenseNumber) {
      throw AppError.badRequest('companyName and licenseNumber are required before requesting verification');
    }
    const current = profile.verificationStatus as keyof typeof AGENCY_VERIFICATION_TRANSITIONS;
    assertTransition(AGENCY_VERIFICATION_TRANSITIONS, current, AGENCY_VERIFICATION_STATUS.PENDING, 'Agency verification');

    const updated = await this.users.updateAgencyVerificationIf(userId, current, {
      agencyProfile: { verificationStatus: AGENCY_VERIFICATION_STATUS.PENDING, verificationNote: null },
    });
    if (!updated) throw AppError.invalidTransition(current, AGENCY_VERIFICATION_STATUS.PENDING, 'Agency verification');
    return toPrivateUserDto(updated);
  }

  // ----------------------------------------------------- Public profiles

  /** Use case "View public tour guide profile" (Guest). Only ACTIVE guides are visible. */
  async getPublicGuide(id: string): Promise<PublicGuideDto> {
    const user = await this.users.findById(id);
    if (!user || user.role !== ROLES.TOUR_GUIDE || user.status !== USER_STATUS.ACTIVE) {
      throw AppError.notFound('Tour guide not found');
    }
    return toPublicGuideDto(user);
  }

  /** Use case "View public agency profile" (Guest). Only ACTIVE agencies are visible. */
  async getPublicAgency(id: string): Promise<PublicAgencyDto> {
    const user = await this.users.findById(id);
    if (!user || user.role !== ROLES.AGENCY || user.status !== USER_STATUS.ACTIVE) {
      throw AppError.notFound('Agency not found');
    }
    return toPublicAgencyDto(user);
  }

  // ------------------------------------------------ Super admin: access

  async listUsers(query: ListUsersQuery): Promise<Page<PrivateUserDto>> {
    const { items, total } = await this.users.list(
      { role: query.role, status: query.status, q: query.q },
      { page: query.page, limit: query.limit },
    );
    return buildPage(items.map(toPrivateUserDto), total, query);
  }

  /**
   * Use case "Assign User Permissions". Also the only way to create MODERATOR / SUPER_ADMIN accounts (DECISIONS D-4).
   * Guards: you cannot change your own access, and the last SUPER_ADMIN cannot be demoted.
   */
  async assignAccess(
    actor: { userId: string; role: PersistedRole },
    targetId: string,
    input: AssignAccessInput,
  ): Promise<PrivateUserDto> {
    const actorId = actor.userId;
    if (actorId === targetId) throw AppError.forbidden('You cannot change your own access');
    const target = await this.requireUser(targetId);

    const patch: UserPatch = {};
    if (input.role && input.role !== target.role) {
      if (target.role === ROLES.SUPER_ADMIN) {
        const superAdmins = await this.users.count({ role: ROLES.SUPER_ADMIN, status: USER_STATUS.ACTIVE });
        if (superAdmins <= 1) throw AppError.conflict('The last SUPER_ADMIN cannot be demoted', 'LAST_SUPER_ADMIN');
      }
      patch.role = input.role;
      if (input.role === ROLES.AGENCY && !target.agencyProfile) {
        patch.agencyProfile = { verificationStatus: AGENCY_VERIFICATION_STATUS.UNVERIFIED };
      }
      if (input.role === ROLES.TOUR_GUIDE && !target.guideProfile) {
        patch.guideProfile = { languages: [], specialties: [] };
      }
    }
    if (input.extraPermissions) {
      patch.extraPermissions = Array.from(new Set(input.extraPermissions.filter(isPermission)));
    }
    if (Object.keys(patch).length === 0) return toPrivateUserDto(target);

    const updated = await this.users.updateById(targetId, patch);

    // The check above can be outrun (two Super admins demoting each other at once). Verify AFTER writing and undo,
    // so the platform is never left without a Super admin.
    if (target.role === ROLES.SUPER_ADMIN && patch.role && (await this.users.count({ role: ROLES.SUPER_ADMIN, status: USER_STATUS.ACTIVE })) === 0) {
      await this.users.updateById(targetId, { role: ROLES.SUPER_ADMIN });
      throw AppError.conflict('The last SUPER_ADMIN cannot be demoted', 'LAST_SUPER_ADMIN');
    }
    await this.audit.record({
      actorId,
      actorRole: actor.role,
      action: AUDIT_ACTIONS.USER_ACCESS_ASSIGNED,
      targetType: 'user',
      targetId,
      metadata: {
        fromRole: target.role,
        toRole: patch.role ?? target.role,
        extraPermissions: patch.extraPermissions ?? undefined,
      },
    });
    return toPrivateUserDto(updated ?? target);
  }

  // ------------------------------------------- Moderation (called by it)

  /** Use case "Ban violating account". Moderators cannot ban staff; nobody can ban a SUPER_ADMIN or themselves. */
  async banUser(actor: { userId: string; role: PersistedRole }, targetId: string, reason: string): Promise<PrivateUserDto> {
    if (actor.userId === targetId) throw AppError.forbidden('You cannot ban yourself');
    const target = await this.requireUser(targetId);
    if (target.role === ROLES.SUPER_ADMIN) throw AppError.forbidden('A SUPER_ADMIN cannot be banned');
    if (STAFF.has(target.role as PersistedRole) && actor.role !== ROLES.SUPER_ADMIN) {
      throw AppError.forbidden('Only a SUPER_ADMIN can ban staff accounts');
    }
    assertTransition(USER_STATUS_TRANSITIONS, target.status as keyof typeof USER_STATUS_TRANSITIONS, USER_STATUS.BANNED, 'Account');

    const updated = await this.users.updateStatusIf(targetId, USER_STATUS.ACTIVE, {
      status: USER_STATUS.BANNED,
      bannedAt: new Date(),
      bannedById: actor.userId,
      banReason: reason,
    });
    if (!updated) throw AppError.invalidTransition(target.status, USER_STATUS.BANNED, 'Account');
    await this.audit.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: AUDIT_ACTIONS.USER_BANNED,
      targetType: 'user',
      targetId,
      metadata: { reason },
    });
    return toPrivateUserDto(updated);
  }

  async unbanUser(actor: { userId: string; role: PersistedRole }, targetId: string): Promise<PrivateUserDto> {
    const target = await this.requireUser(targetId);
    assertTransition(USER_STATUS_TRANSITIONS, target.status as keyof typeof USER_STATUS_TRANSITIONS, USER_STATUS.ACTIVE, 'Account');
    const updated = await this.users.updateStatusIf(targetId, USER_STATUS.BANNED, {
      status: USER_STATUS.ACTIVE,
      bannedAt: null,
      bannedById: null,
      banReason: null,
    });
    if (!updated) throw AppError.invalidTransition(target.status, USER_STATUS.ACTIVE, 'Account');
    await this.audit.record({
      actorId: actor.userId,
      actorRole: actor.role,
      action: AUDIT_ACTIONS.USER_UNBANNED,
      targetType: 'user',
      targetId,
    });
    return toPrivateUserDto(updated);
  }

  /** Use case "Verify Agency Profile" decision (called by moderation). */
  async decideAgencyVerification(
    moderator: { userId: string; role: PersistedRole },
    agencyId: string,
    decision: { approve: boolean; note?: string },
  ): Promise<PrivateUserDto> {
    const agency = await this.requireUser(agencyId);
    if (agency.role !== ROLES.AGENCY || !agency.agencyProfile) throw AppError.notFound('Agency not found');

    const next = decision.approve ? AGENCY_VERIFICATION_STATUS.VERIFIED : AGENCY_VERIFICATION_STATUS.REJECTED;
    const current = agency.agencyProfile.verificationStatus as keyof typeof AGENCY_VERIFICATION_TRANSITIONS;
    assertTransition(AGENCY_VERIFICATION_TRANSITIONS, current, next, 'Agency verification');

    const update: UserPatch = {
      agencyProfile: {
        verificationStatus: next,
        verifiedById: moderator.userId,
        verifiedAt: new Date(),
        ...(decision.note ? { verificationNote: decision.note } : {}),
      },
    };
    const updated = await this.users.updateAgencyVerificationIf(agencyId, current, update);
    if (!updated) throw AppError.invalidTransition(current, next, 'Agency verification'); // another moderator decided first
    await this.audit.record({
      actorId: moderator.userId,
      actorRole: moderator.role,
      action: AUDIT_ACTIONS.AGENCY_VERIFICATION_DECIDED,
      targetType: 'user',
      targetId: agencyId,
      metadata: { approved: decision.approve, note: decision.note },
    });
    return toPrivateUserDto(updated);
  }

  async listAgenciesByVerification(
    status: (typeof AGENCY_VERIFICATION_STATUS)[keyof typeof AGENCY_VERIFICATION_STATUS],
    page: { page: number; limit: number },
  ): Promise<Page<PrivateUserDto>> {
    // Filtered in the repository list by role, then narrowed by status here would break pagination, so ask the repo.
    const { items, total } = await this.users.list({ role: ROLES.AGENCY, agencyVerification: status }, page);
    return buildPage(items.map(toPrivateUserDto), total, page);
  }

  /** Account counters for dashboards. */
  async getStats(now = new Date()): Promise<{
    byRole: Record<string, number>;
    byStatus: Record<string, number>;
    newLast30Days: number;
    agenciesPendingVerification: number;
  }> {
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [byRole, byStatus, newLast30Days, agenciesPendingVerification] = await Promise.all([
      this.users.countGroupedBy('role'),
      this.users.countGroupedBy('status'),
      this.users.countCreatedSince(since),
      this.users.countAgenciesByVerification(AGENCY_VERIFICATION_STATUS.PENDING),
    ]);
    return { byRole, byStatus, newLast30Days, agenciesPendingVerification };
  }

  // ------------------------------------------ Helpers for other modules

  /** Id -> short public info, for embedding names/avatars in other modules' responses. Unknown ids are omitted. */
  async getSummaries(ids: string[]): Promise<Map<string, UserSummary>> {
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return new Map();
    const users = await this.users.findManyByIds(unique);
    return new Map(
      users.map((user) => [
        user.id,
        { id: user.id, fullName: user.fullName, avatarUrl: user.avatarUrl ?? undefined, role: user.role as PersistedRole },
      ]),
    );
  }

  /** Email + name of an ACTIVE account, for notification emails. Null when the user is gone or not active. */
  async getContact(userId: string): Promise<{ email: string; fullName: string } | null> {
    const user = await this.users.findById(userId);
    return user && user.status === USER_STATUS.ACTIVE ? { email: user.email, fullName: user.fullName } : null;
  }

  /** Throws 403 unless the agency profile is VERIFIED (required before tours can be submitted for review, DECISIONS D-27). */
  async assertAgencyVerified(agencyId: string): Promise<void> {
    const agency = await this.assertActiveWithRole(agencyId, ROLES.AGENCY);
    if (agency.agencyProfile?.verificationStatus !== AGENCY_VERIFICATION_STATUS.VERIFIED) {
      throw AppError.forbidden('Your agency profile must be verified before tours can be submitted', 'AGENCY_NOT_VERIFIED');
    }
  }

  /** Throws 404 unless the id is an ACTIVE user with the given role (e.g. before assigning a guide to a tour). */
  async assertActiveWithRole(id: string, role: PersistedRole): Promise<UserRecord> {
    const user = await this.users.findById(id);
    if (!user || user.role !== role || user.status !== USER_STATUS.ACTIVE) {
      throw AppError.notFound(`${role} not found`);
    }
    return user;
  }

  private async requireUser(id: string): Promise<UserRecord> {
    const user = await this.users.findById(id);
    if (!user) throw AppError.notFound('User not found');
    return user;
  }
}

export const usersService = new UsersService();

/** The fields of `value` that are not `undefined`, or `undefined` when there are none. */
function definedEntries<T extends object>(value: T | undefined): Partial<T> | undefined {
  const entries = Object.entries(value ?? {}).filter(([, v]) => v !== undefined);
  return entries.length > 0 ? (Object.fromEntries(entries) as Partial<T>) : undefined;
}
