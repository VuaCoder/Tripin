import {
  COMPLAINT_TAXONOMY,
  type ComplaintTicketCategory,
  type ComplaintTicketPriority,
  type ComplaintTicketStatus,
} from '@travel-platform/constants';

export { COMPLAINT_TAXONOMY };

export const STATUS_LABELS: Record<
  ComplaintTicketStatus,
  { label: string; className: string; description: string }
> = {
  OPEN: {
    label: 'Chờ tiếp nhận',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
    description: 'Phiếu đã gửi tới đối tác và đang chờ tiếp nhận xử lý.',
  },
  IN_PROGRESS: {
    label: 'Đang xử lý',
    className: 'bg-blue-50 text-blue-800 border-blue-200',
    description: 'Hai bên đang tích cực trao đổi và giải quyết sự việc.',
  },
  RESOLVED: {
    label: 'Đã đề xuất giải pháp',
    className: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    description: 'Đối tác đã đưa ra giải pháp khắc phục. Đang chờ khách hàng xác nhận.',
  },
  CLOSED: {
    label: 'Đã đóng',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    description: 'Vụ việc đã giải quyết xong và đóng phiếu hoàn tất.',
  },
  ESCALATED: {
    label: 'Sàn đang phân xử',
    className: 'bg-rose-50 text-rose-800 border-rose-200',
    description: 'Hai bên chưa tìm được tiếng nói chung. Kiểm duyệt viên sàn đang làm trọng tài phân xử.',
  },
};

export const PRIORITY_LABELS: Record<
  ComplaintTicketPriority,
  { label: string; className: string }
> = {
  NORMAL: {
    label: 'Bình thường',
    className: 'bg-slate-100 text-slate-700',
  },
  HIGH: {
    label: 'Ưu tiên cao',
    className: 'bg-amber-100 text-amber-800',
  },
  URGENT: {
    label: 'Khẩn cấp',
    className: 'bg-rose-100 text-rose-800 font-bold',
  },
};

export function getCategoryLabel(categoryId: ComplaintTicketCategory): string {
  const found = COMPLAINT_TAXONOMY.find((c) => c.id === categoryId);
  return found?.label ?? categoryId;
}

export function getSubCategoryLabel(categoryId: ComplaintTicketCategory, subCategoryId: string): string {
  const group = COMPLAINT_TAXONOMY.find((c) => c.id === categoryId);
  const sub = group?.subCategories.find((s) => s.id === subCategoryId);
  return sub?.label ?? subCategoryId;
}

export const COMPLAINT_ERROR_MESSAGES: Record<string, string> = {
  COMPLAINT_ALREADY_OPEN: 'Bạn đã có một phiếu khiếu nại đang xử lý cho tour này. Vui lòng tiếp tục trao đổi trên phiếu đó.',
  NOT_FOUND: 'Không tìm thấy tour hoặc phiếu khiếu nại này.',
  TICKET_CLOSED: 'Phiếu khiếu nại này đã đóng hoàn tất.',
  TICKET_FULL: 'Cuộc hội thoại đã đạt giới hạn tối đa số lượng tin nhắn.',
  FEEDBACK_EXISTS: 'Bạn đã gửi đánh giá chất lượng phục vụ cho phiếu này rồi.',
  TICKET_NOT_CLOSED: 'Phiếu khiếu nại cần được đóng trước khi gửi đánh giá.',
  CONCURRENT_UPDATE: 'Phiếu vừa được cập nhật bởi bên kia. Vui lòng làm mới trang.',
};
