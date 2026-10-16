import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { uploadImageBuffer } from '../../integrations/cloudinary';
import { AppError } from '../../utils/app-error';
import { sendOk } from '../../utils/api-response';
import { agencyApprovalService, type AgencyApprovalService } from './agency-approval.service';

export class AgencyApprovalController {
  constructor(private readonly service: AgencyApprovalService = agencyApprovalService) {}

  getStatus = async (req: Request, res: Response) => {
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    const email = typeof req.query.email === 'string' ? req.query.email : undefined;
    const userId = req.user?.id;

    const data = await this.service.getStatus({ token, email, userId });
    sendOk(res, data);
  };

  devAccept = async (req: Request, res: Response) => {
    const { email, token } = req.body as { email?: string; token?: string };
    const result = await this.service.devAccept({ email, token });
    sendOk(res, result);
  };

  devReject = async (req: Request, res: Response) => {
    const { email, token, reason } = req.body as { email?: string; token?: string; reason?: string };
    if (!reason || typeof reason !== 'string') {
      throw AppError.badRequest('Vui lòng nhập lý do từ chối hồ sơ');
    }
    const result = await this.service.devReject({ email, token, reason });
    sendOk(res, result);
  };

  getApplication = async (req: Request, res: Response) => {
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    const email = typeof req.query.email === 'string' ? req.query.email : undefined;
    const userId = req.user?.id;

    const data = await this.service.getApplication({ token, email, userId });
    sendOk(res, data);
  };

  updateApplication = async (req: Request, res: Response) => {
    const token = typeof req.body.token === 'string' ? req.body.token : undefined;
    const email = typeof req.body.email === 'string' ? req.body.email : undefined;
    const userId = req.user?.id;

    const { fullName, phone, companyName, licenseNumber, taxId, businessLicenseUrl, address, description, website } = req.body;
    if (!fullName || !phone || !companyName || !licenseNumber || !address) {
      throw AppError.badRequest('Vui lòng điền đầy đủ các thông tin bắt buộc');
    }

    const result = await this.service.updateApplication(
      { token, email, userId },
      { fullName, phone, companyName, licenseNumber, taxId, businessLicenseUrl, address, description, website },
    );
    sendOk(res, result);
  };

  uploadLicense = async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      throw AppError.badRequest('Vui lòng chọn file ảnh giấy phép kinh doanh');
    }

    const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedMime.has(file.mimetype)) {
      throw AppError.badRequest('Chỉ hỗ trợ file ảnh định dạng JPG, PNG hoặc WebP');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw AppError.badRequest('Kích thước file ảnh không được vượt quá 5 MB');
    }

    const identifier = req.user?.id || randomUUID();
    const result = await uploadImageBuffer('agencyLicenseImage', identifier, file.buffer, file.mimetype);
    sendOk(res, { url: result.secureUrl, publicId: result.publicId });
  };
}

export const agencyApprovalController = new AgencyApprovalController();
