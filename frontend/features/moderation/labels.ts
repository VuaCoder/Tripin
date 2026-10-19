import type { AgencyVerificationStatus, ModerationTourStatus, ReviewStatus, TicketCategory, TicketStatus } from './types';

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
/** `resolveReportBody.note` allows more than the shared reason limit; the resolve action uses this. */
export const RESOLUTION_MAX = 2000;
/** Mirrors `ticketReplyBody.text` in the backend. */
export const TICKET_TEXT_MIN = 2;
export const TICKET_TEXT_MAX = 4000;

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, { label: string; className: string }> = {
  VISIBLE: { label: 'Đang hiển thị', className: 'bg-emerald-50 text-emerald-700' },
  HIDDEN: { label: 'Đã ẩn', className: 'bg-slate-100 text-slate-600' },
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, { label: string; className: string }> = {
  OPEN: { label: 'Mới', className: 'bg-amber-50 text-amber-700' },
  IN_PROGRESS: { label: 'Đang xử lý', className: 'bg-blue-50 text-blue-700' },
  RESOLVED: { label: 'Đã giải quyết', className: 'bg-emerald-50 text-emerald-700' },
  CLOSED: { label: 'Đã đóng', className: 'bg-slate-100 text-slate-500' },
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  BOOKING: 'Đặt chỗ',
  PAYMENT: 'Thanh toán',
  ACCOUNT: 'Tài khoản',
  TOUR: 'Tour',
  OTHER: 'Khác',
};

/** Mirrors `reason` / `note` (trimmed, 3..1000) — and, for a resolution note, up to `RESOLUTION_MAX`. */
export function validateReason(text: string, max = REASON_MAX): string | null {
  const length = text.trim().length;
  if (length < REASON_MIN) return `Lý do cần ít nhất ${REASON_MIN} ký tự.`;
  if (length > max) return `Lý do tối đa ${max} ký tự.`;
  return null;
}

/** Mirrors `ticketReplyBody.text` (trimmed, 2..4000). */
export function validateTicketText(text: string): string | null {
  const length = text.trim().length;
  if (length < TICKET_TEXT_MIN) return `Nội dung trả lời cần ít nhất ${TICKET_TEXT_MIN} ký tự.`;
  if (length > TICKET_TEXT_MAX) return `Nội dung trả lời tối đa ${TICKET_TEXT_MAX} ký tự.`;
  return null;
}

export const MODERATION_ERROR_MESSAGES: Record<string, string> = {
  CONCURRENT_UPDATE: 'Dữ liệu vừa được người khác thay đổi. Danh sách đã được tải lại, vui lòng kiểm tra rồi thử lại.',
  INVALID_STATE_TRANSITION: 'Trạng thái hiện tại không cho phép thao tác này. Có thể kiểm duyệt viên khác đã xử lý trước.',
  REPORT_ALREADY_OPEN: 'Người dùng này đã có một báo cáo đang mở về nội dung đó.',
  TICKET_CLOSED: 'Khiếu nại này đã đóng nên không thể trả lời thêm.',
  TICKET_FULL: 'Khiếu nại này đã đạt giới hạn tin nhắn.',
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
  reviewModerate: 'review:moderate',
  disputeResolve: 'dispute:resolve',
  complaintHandle: 'complaint:handle',
  accountBan: 'account:ban',
} as const;
