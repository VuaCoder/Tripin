import { AGENCY_VERIFICATION_STATUS, isPermission, resolvePermissions, type Role } from '@travel-platform/constants';
import type { UserDocument } from './users.model';
import type { PrivateUserDto, PublicAgencyDto, PublicGuideDto } from './users.types';

/** Effective permissions of a stored user (role defaults + extras granted by SUPER_ADMIN). */
export function permissionsOf(user: Pick<UserDocument, 'role' | 'extraPermissions'>) {
  return resolvePermissions(user.role as Role, (user.extraPermissions ?? []).filter(isPermission));
}

const iso = (date?: Date | null) => date?.toISOString();

export function toPrivateUserDto(user: UserDocument): PrivateUserDto {
  const agency = user.agencyProfile;
  const guide = user.guideProfile;
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
    role: user.role as Role,
    status: user.status as PrivateUserDto['status'],
    permissions: permissionsOf(user),
    extraPermissions: (user.extraPermissions ?? []).filter(isPermission),
    twoFactorEnabled: user.twoFactorEnabled,
    emailVerifiedAt: iso(user.emailVerifiedAt),
    createdAt: (user as unknown as { createdAt: Date }).createdAt.toISOString(),
    bannedAt: iso(user.bannedAt),
    banReason: user.banReason ?? undefined,
    agencyProfile: agency
      ? {
          companyName: agency.companyName ?? undefined,
          description: agency.description ?? undefined,
          address: agency.address ?? undefined,
          website: agency.website ?? undefined,
          licenseNumber: agency.licenseNumber ?? undefined,
          verificationStatus: agency.verificationStatus as NonNullable<PrivateUserDto['agencyProfile']>['verificationStatus'],
          verificationNote: agency.verificationNote ?? undefined,
        }
      : undefined,
    guideProfile: guide
      ? {
          bio: guide.bio ?? undefined,
          languages: guide.languages ?? [],
          specialties: guide.specialties ?? [],
          experienceYears: guide.experienceYears ?? undefined,
          licenseNumber: guide.licenseNumber ?? undefined,
        }
      : undefined,
  };
}

export function toPublicGuideDto(user: UserDocument): PublicGuideDto {
  const guide = user.guideProfile;
  return {
    id: user.id,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl ?? undefined,
    bio: guide?.bio ?? undefined,
    languages: guide?.languages ?? [],
    specialties: guide?.specialties ?? [],
    experienceYears: guide?.experienceYears ?? undefined,
  };
}

export function toPublicAgencyDto(user: UserDocument): PublicAgencyDto {
  const agency = user.agencyProfile;
  return {
    id: user.id,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl ?? undefined,
    companyName: agency?.companyName ?? undefined,
    description: agency?.description ?? undefined,
    address: agency?.address ?? undefined,
    website: agency?.website ?? undefined,
    verified: agency?.verificationStatus === AGENCY_VERIFICATION_STATUS.VERIFIED,
  };
}
