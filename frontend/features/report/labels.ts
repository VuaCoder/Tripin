import { REPORT_DESCRIPTION_MAX, REPORT_DESCRIPTION_MIN, type ReportCategory, type ReportStatus, type ReportTarget } from './types';

/** The report vocabulary is shared by the Traveler UI and the Moderator queue — it lives here once. */

export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = {
  TOUR: 'Tour',
  USER: 'Tài khoản đối tác',
  REVIEW: 'Đánh giá',
};

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  MISLEADING_INFO: 'Thông tin sai lệch',
  SAFETY: 'An toàn',
  SERVICE_QUALITY: 'Chất lượng dịch vụ',
  PAYMENT_OR_REFUND: 'Thanh toán / hoàn tiền',
  INAPPROPRIATE_CONTENT: 'Nội dung không phù hợp',
  OTHER: 'Khác',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, { label: string; className: string }> = {
  OPEN: { label: 'Đang mở', className: 'bg-amber-50 text-amber-700' },
  AGENCY_RESPONDED: { label: 'Đối tác đã phản hồi', className: 'bg-blue-50 text-blue-700' },
  RESOLVED: { label: 'Đã giải quyết', className: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'Đã bác bỏ', className: 'bg-slate-100 text-slate-600' },
};

/** Mirrors `createReportBody` in the backend. */
export function validateReportDescription(text: string): string | null {
  const length = text.trim().length;
  if (length < REPORT_DESCRIPTION_MIN) return `Vui lòng mô tả vấn đề (ít nhất ${REPORT_DESCRIPTION_MIN} ký tự).`;
  if (length > REPORT_DESCRIPTION_MAX) return `Mô tả tối đa ${REPORT_DESCRIPTION_MAX} ký tự.`;
  return null;
}

export const REPORT_ERROR_MESSAGES: Record<string, string> = {
  REPORT_ALREADY_OPEN: 'Bạn đã có một báo cáo đang mở về nội dung này. Vui lòng chờ kiểm duyệt viên xử lý.',
  NOT_FOUND: 'Không tìm thấy nội dung bị báo cáo. Có thể nó đã bị xóa.',
  FORBIDDEN: 'Bạn không có quyền gửi báo cáo.',
  VALIDATION_ERROR: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
  CONFLICT: 'Báo cáo này vừa được gửi. Vui lòng kiểm tra danh sách báo cáo của bạn.',
};
