import type { AgencyVerificationStatus, ModerationTourStatus } from './types';

export const TOUR_STATUS_LABELS: Record<ModerationTourStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Bản nháp', className: 'bg-slate-100 text-slate-600' },
  PENDING_REVIEW: { label: 'Chờ duyệt', className: 'bg-amber-50 text-amber-700' },
  APPROVED: { label: 'Đã duyệt', className: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'Bị từ chối', className: 'bg-red-50 text-red-700' },
  SUSPENDED: { label: 'Tạm ngưng', className: 'bg-orange-50 text-orange-700' },
  ARCHIVED: { label: 'Lưu trữ', className: 'bg-slate-100 text-slate-500' },
};

export const AGENCY_STATUS_LABELS: Record<AgencyVerificationStatus, { label: string; className: string }> = {
  UNVERIFIED: { label: 'Chưa gửi hồ sơ', className: 'bg-slate-100 text-slate-600' },
  PENDING: { label: 'Chờ xác minh', className: 'bg-amber-50 text-amber-700' },
  VERIFIED: { label: 'Đã xác minh', className: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'Bị từ chối', className: 'bg-red-50 text-red-700' },
};

export const REASON_MIN = 3;
export const REASON_MAX = 1000;

/** Mirrors the backend `reason` / `note` rule (trimmed, 3..1000 characters). */
export function validateReason(text: string): string | null {
  const length = text.trim().length;
  if (length < REASON_MIN) return `Lý do cần ít nhất ${REASON_MIN} ký tự.`;
  if (length > REASON_MAX) return `Lý do tối đa ${REASON_MAX} ký tự.`;
  return null;
}

export const MODERATION_ERROR_MESSAGES: Record<string, string> = {
  CONCURRENT_UPDATE: 'Dữ liệu vừa được người khác thay đổi. Danh sách đã được tải lại, vui lòng kiểm tra rồi thử lại.',
  INVALID_TRANSITION: 'Trạng thái hiện tại không cho phép thao tác này. Có thể kiểm duyệt viên khác đã xử lý trước.',
  NOT_FOUND: 'Không tìm thấy mục này. Có thể nó đã bị xóa.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  VALIDATION_ERROR: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
};

export const PERMISSION = {
  dashboard: 'moderation:dashboard',
  tourList: 'tour:list-all',
  tourValidate: 'tour:validate',
  tourSuspend: 'tour:suspend',
  agencyVerify: 'agency:verify',
} as const;
