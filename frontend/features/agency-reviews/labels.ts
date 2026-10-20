import { REPORT_CATEGORY_LABELS } from '@/features/report/labels';
import type { ReportCategory } from '@/features/report/types';

/** The categories an agency can pick when disputing a review (the report vocabulary lives in `features/report`). */
export const DISPUTE_CATEGORIES = Object.keys(REPORT_CATEGORY_LABELS) as ReportCategory[];

export const DISPUTE_ERROR_MESSAGES: Record<string, string> = {
  REPORT_ALREADY_OPEN: 'Bạn đã có một phản ánh đang chờ xử lý cho đánh giá này.',
  NOT_FOUND: 'Không tìm thấy đánh giá này trong số đánh giá về tour của bạn.',
  FORBIDDEN: 'Bạn không có quyền phản ánh đánh giá.',
  VALIDATION_ERROR: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
};
