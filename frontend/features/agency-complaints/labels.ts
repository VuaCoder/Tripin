import type { ComplaintCategory, ComplaintStatus } from './types';

export const STATUS_LABELS: Record<ComplaintStatus, { label: string; className: string }> = {
  OPEN: { label: 'Chờ phản hồi', className: 'bg-amber-50 text-amber-700' },
  AGENCY_RESPONDED: { label: 'Đã phản hồi', className: 'bg-blue-50 text-blue-700' },
  RESOLVED: { label: 'Đã giải quyết', className: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'Đã bác bỏ', className: 'bg-slate-100 text-slate-600' },
};

export const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  MISLEADING_INFO: 'Thông tin sai lệch',
  SAFETY: 'An toàn',
  SERVICE_QUALITY: 'Chất lượng dịch vụ',
  PAYMENT_OR_REFUND: 'Thanh toán / hoàn tiền',
  INAPPROPRIATE_CONTENT: 'Nội dung không phù hợp',
  OTHER: 'Khác',
};

export const RESPONSE_MIN = 5;
export const RESPONSE_MAX = 2000;

/** Mirrors `respondBody` in the backend. */
export function validateResponseText(text: string): string | null {
  const length = text.trim().length;
  if (length < RESPONSE_MIN) return `Phản hồi cần ít nhất ${RESPONSE_MIN} ký tự.`;
  if (length > RESPONSE_MAX) return `Phản hồi tối đa ${RESPONSE_MAX} ký tự.`;
  return null;
}

export const COMPLAINT_ERROR_MESSAGES: Record<string, string> = {
  INVALID_STATE_TRANSITION: 'Khiếu nại này đã được xử lý nên không thể phản hồi thêm.',
};
