import { signOnboardingToken, readOnboardingToken } from './onboarding.tokens';
import { prisma } from '../../config/database';
import { AGENCY_VERIFICATION_STATUS, ROLES } from '@travel-platform/constants';
import { isProduction } from '../../config/env';
import { mailProvider, type MailProvider } from '../../integrations/mail';
import { AppError } from '../../utils/app-error';
import { usersRepository, type UsersRepository } from '../users/users.repository';
import { buildAgencyApprovedMail, buildAgencyRejectedMail } from './agency-approval.mail';

export interface AgencyStatusDto {
  email: string;
  companyName: string;
  fullName: string;
  verificationStatus: string;
  verificationNote?: string | null;
  submittedAt: string;
  token: string;
}

export interface AgencyApplicationDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  licenseNumber: string;
  taxId?: string | null;
  businessLicenseUrl?: string | null;
  address: string;
  description?: string | null;
  website?: string | null;
  verificationStatus: string;
  verificationNote?: string | null;
}

export interface UpdateApplicationInput {
  fullName: string;
  phone: string;
  companyName: string;
  licenseNumber: string;
  taxId?: string;
  businessLicenseUrl?: string;
  address: string;
  description?: string;
  website?: string;
}

export class AgencyApprovalService {
  constructor(
    private readonly users: UsersRepository = usersRepository,
    private readonly mail: MailProvider = mailProvider,
  ) {}

  generateStatusToken(email: string, tokenVersion = 0): string {
    return signOnboardingToken(email, tokenVersion);
  }

  verifyStatusToken(token: string): string { return readOnboardingToken(token).email; }

  private async resolveEmail(query: { email?: string; token?: string; userId?: string }): Promise<string> {
    // Authenticated identity takes precedence over every client-supplied selector.
    if (query.userId) {
      const user = await this.users.findById(query.userId);
      if (!user || user.role !== ROLES.AGENCY) throw AppError.forbidden('Agency account required');
      await this.assertOwner(user.id);
      return user.email;
    }
    if (query.token) {
      const payload = readOnboardingToken(query.token);
      const user = await this.users.findByEmail(payload.email);
      if (!user || user.role !== ROLES.AGENCY || user.status !== 'ACTIVE' || user.tokenVersion !== payload.tokenVersion) throw AppError.unauthenticated('Onboarding session revoked');
      await this.assertOwner(user.id);
      return user.email;
    }
    throw AppError.unauthenticated('Sign in or use a valid onboarding token');
  }

  private async assertOwner(userId: string) {
    const member = await prisma.agencyMember.findFirst({ where: { userId, agency: { userId }, role: 'OWNER', status: 'ACTIVE' } });
    if (!member) throw AppError.forbidden('Active agency OWNER membership required');
  }

  async getStatus(query: { email?: string; token?: string; userId?: string }): Promise<AgencyStatusDto> {
    const email = await this.resolveEmail(query);
    const user = await this.users.findByEmail(email);
    if (!user || user.role !== ROLES.AGENCY || !user.agencyProfile) {
      throw AppError.notFound('Không tìm thấy thông tin Agency');
    }

    const token = query.userId ? this.generateStatusToken(user.email, user.tokenVersion) : query.token!;
    return {
      email: user.email,
      fullName: user.fullName,
      companyName: user.agencyProfile.companyName || user.fullName,
      verificationStatus: user.agencyProfile.verificationStatus,
      verificationNote: user.agencyProfile.verificationNote,
      submittedAt: user.agencyProfile.submittedAt?.toISOString() || user.createdAt.toISOString(),
      token,
    };
  }

  async devAccept(query: { email?: string; token?: string }): Promise<{ success: true; message: string; status: AgencyStatusDto }> {
    if (isProduction) {
      throw AppError.forbidden('Chức năng giả lập chỉ được phép sử dụng trong môi trường development');
    }

    const email = await this.resolveEmail(query);
    const user = await this.users.findByEmail(email);
    if (!user || user.role !== ROLES.AGENCY || !user.agencyProfile) {
      throw AppError.notFound('Không tìm thấy thông tin Agency');
    }

    if (user.agencyProfile.verificationStatus !== AGENCY_VERIFICATION_STATUS.PENDING) {
      throw AppError.badRequest(`Hồ sơ hiện không ở trạng thái chờ duyệt (Trạng thái hiện tại: ${user.agencyProfile.verificationStatus})`);
    }

    await this.users.updateById(user.id, {
      agencyProfile: {
        verificationStatus: AGENCY_VERIFICATION_STATUS.VERIFIED,
        verificationNote: null,
        verifiedAt: new Date(),
      },
    });

    // Gửi email chúc mừng phê duyệt
    const companyName = user.agencyProfile.companyName || user.fullName;
    await this.mail.send(buildAgencyApprovedMail(user.email, companyName)).catch(() => undefined);

    const updatedStatus = await this.getStatus({ userId: user.id });
    return { success: true, message: 'Hồ sơ đã được phê duyệt thành công', status: updatedStatus };
  }

  async devReject(query: { email?: string; token?: string; reason: string }): Promise<{ success: true; message: string; status: AgencyStatusDto }> {
    if (isProduction) {
      throw AppError.forbidden('Chức năng giả lập chỉ được phép sử dụng trong môi trường development');
    }

    if (!query.reason?.trim()) {
      throw AppError.badRequest('Vui lòng nhập lý do từ chối hồ sơ');
    }

    const email = await this.resolveEmail(query);
    const user = await this.users.findByEmail(email);
    if (!user || user.role !== ROLES.AGENCY || !user.agencyProfile) {
      throw AppError.notFound('Không tìm thấy thông tin Agency');
    }

    if (user.agencyProfile.verificationStatus !== AGENCY_VERIFICATION_STATUS.PENDING) {
      throw AppError.badRequest(`Hồ sơ hiện không ở trạng thái chờ duyệt (Trạng thái hiện tại: ${user.agencyProfile.verificationStatus})`);
    }

    const reason = query.reason.trim();
    await this.users.updateById(user.id, {
      agencyProfile: {
        verificationStatus: AGENCY_VERIFICATION_STATUS.REJECTED,
        verificationNote: reason,
        verifiedAt: new Date(),
      },
    });

    // Gửi email thông báo từ chối kèm lý do
    const companyName = user.agencyProfile.companyName || user.fullName;
    await this.mail.send(buildAgencyRejectedMail(user.email, companyName, reason)).catch(() => undefined);

    const updatedStatus = await this.getStatus({ userId: user.id });
    return { success: true, message: 'Đã từ chối hồ sơ thành công', status: updatedStatus };
  }

  async getApplication(query: { email?: string; token?: string; userId?: string }): Promise<AgencyApplicationDto> {
    const email = await this.resolveEmail(query);
    const user = await this.users.findByEmail(email);
    if (!user || user.role !== ROLES.AGENCY || !user.agencyProfile) {
      throw AppError.notFound('Không tìm thấy hồ sơ doanh nghiệp');
    }

    const p = user.agencyProfile;
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || '',
      companyName: p.companyName || '',
      licenseNumber: p.licenseNumber || '',
      taxId: p.taxId || null,
      businessLicenseUrl: p.businessLicenseUrl || null,
      address: p.address || '',
      description: p.description || null,
      website: p.website || null,
      verificationStatus: p.verificationStatus,
      verificationNote: p.verificationNote || null,
    };
  }

  async updateApplication(
    query: { email?: string; token?: string; userId?: string },
    input: UpdateApplicationInput,
  ): Promise<{ success: true; message: string; status: AgencyStatusDto }> {
    const email = await this.resolveEmail(query);
    const user = await this.users.findByEmail(email);
    if (!user || user.role !== ROLES.AGENCY || !user.agencyProfile) {
      throw AppError.notFound('Không tìm thấy hồ sơ doanh nghiệp');
    }

    if (![AGENCY_VERIFICATION_STATUS.REJECTED, AGENCY_VERIFICATION_STATUS.INFORMATION_REQUESTED].includes(user.agencyProfile.verificationStatus as "REJECTED" | "INFORMATION_REQUESTED")) {
      throw AppError.badRequest('Chỉ có thể chỉnh sửa và gửi lại hồ sơ khi đang ở trạng thái bị từ chối');
    }

    const updated = await this.users.updateAgencyVerificationIf(user.id, user.agencyProfile.verificationStatus, {
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      agencyProfile: {
        companyName: input.companyName.trim(),
        licenseNumber: input.licenseNumber.trim(),
        taxId: input.taxId?.trim() || null,
        businessLicenseUrl: input.businessLicenseUrl?.trim() || null,
        address: input.address.trim(),
        description: input.description?.trim() || null,
        website: input.website?.trim() || null,
        verificationStatus: AGENCY_VERIFICATION_STATUS.PENDING,
              submittedAt: new Date(),
              submissionDateEstimated: false,
        verificationNote: null,
      },
    });

    if (!updated) throw AppError.conflict('Agency application changed; reload and retry', 'CONCURRENT_UPDATE');
    const status = await this.getStatus({ userId: user.id });
    return { success: true, message: 'Đã gửi lại hồ sơ thành công. Hồ sơ đang được chờ xét duyệt.', status };
  }
}

export const agencyApprovalService = new AgencyApprovalService();
