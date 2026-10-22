export const COMPLAINT_TICKET_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  ESCALATED: 'ESCALATED',
} as const;
export type ComplaintTicketStatus = (typeof COMPLAINT_TICKET_STATUS)[keyof typeof COMPLAINT_TICKET_STATUS];

export const COMPLAINT_TICKET_PRIORITY = {
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type ComplaintTicketPriority = (typeof COMPLAINT_TICKET_PRIORITY)[keyof typeof COMPLAINT_TICKET_PRIORITY];

export const COMPLAINT_TICKET_CATEGORY = {
  ITINERARY: 'ITINERARY',
  TRANSPORT: 'TRANSPORT',
  ACCOMMODATION_DINING: 'ACCOMMODATION_DINING',
  GUIDE_SERVICE: 'GUIDE_SERVICE',
  BILLING_REFUND: 'BILLING_REFUND',
  SAFETY_URGENT: 'SAFETY_URGENT',
  OTHER: 'OTHER',
} as const;
export type ComplaintTicketCategory = (typeof COMPLAINT_TICKET_CATEGORY)[keyof typeof COMPLAINT_TICKET_CATEGORY];

export interface ComplaintTaxonomyItem {
  id: string;
  label: string;
  defaultPriority: ComplaintTicketPriority;
}

export interface ComplaintCategoryTaxonomy {
  id: ComplaintTicketCategory;
  label: string;
  subCategories: ComplaintTaxonomyItem[];
}

export const COMPLAINT_TAXONOMY: ComplaintCategoryTaxonomy[] = [
  {
    id: COMPLAINT_TICKET_CATEGORY.ITINERARY,
    label: 'Lịch trình & Chương trình tour',
    subCategories: [
      { id: 'ITINERARY_SKIPPED_ATTRACTION', label: 'Bỏ sót / cắt xén điểm tham quan không báo trước', defaultPriority: 'NORMAL' },
      { id: 'ITINERARY_RUSHED_OR_DELAYED', label: 'Thời gian tham quan quá gấp gáp / lệch lịch trình', defaultPriority: 'NORMAL' },
      { id: 'ITINERARY_UNANNOUNCED_CHANGE', label: 'Đổi lịch trình đột ngột không có lý do chính đáng', defaultPriority: 'NORMAL' },
    ],
  },
  {
    id: COMPLAINT_TICKET_CATEGORY.TRANSPORT,
    label: 'Phương tiện & Vận chuyển',
    subCategories: [
      { id: 'TRANSPORT_LATE_OR_MISSED_PICKUP', label: 'Xe đón muộn / không đến đón', defaultPriority: 'HIGH' },
      { id: 'TRANSPORT_BAD_CONDITION', label: 'Xe không đúng cam kết (hỏng điều hòa, thiếu chỗ, bẩn)', defaultPriority: 'HIGH' },
      { id: 'TRANSPORT_RECKLESS_DRIVER', label: 'Tài xế phóng nhanh vượt ẩu / thái độ thiếu chuẩn mực', defaultPriority: 'HIGH' },
    ],
  },
  {
    id: COMPLAINT_TICKET_CATEGORY.ACCOMMODATION_DINING,
    label: 'Lưu trú & Ẩm thực',
    subCategories: [
      { id: 'ACCOMMODATION_WRONG_HOTEL_STANDARD', label: 'Khách sạn không đúng chuẩn sao / sai hạng phòng', defaultPriority: 'NORMAL' },
      { id: 'ACCOMMODATION_UNHYGIENIC_ROOM', label: 'Phòng không sạch sẽ, phát sinh vấn đề vệ sinh', defaultPriority: 'NORMAL' },
      { id: 'DINING_POOR_QUALITY_OR_UNSAFE', label: 'Bữa ăn không đảm bảo chất lượng / thiếu định lượng', defaultPriority: 'NORMAL' },
    ],
  },
  {
    id: COMPLAINT_TICKET_CATEGORY.GUIDE_SERVICE,
    label: 'Hướng dẫn viên & Dịch vụ',
    subCategories: [
      { id: 'GUIDE_ABSENT_OR_INCOMPETENT', label: 'Hướng dẫn viên vắng mặt / thiếu kiến thức chuyên môn', defaultPriority: 'HIGH' },
      { id: 'GUIDE_RUDE_ATTITUDE', label: 'Thái độ phục vụ bất lịch sự, xúc phạm khách', defaultPriority: 'HIGH' },
      { id: 'GUIDE_FORCED_SHOPPING_OR_TIP', label: 'Ép buộc mua sắm / vòi tiền boa (tip) ngoài quy định', defaultPriority: 'HIGH' },
    ],
  },
  {
    id: COMPLAINT_TICKET_CATEGORY.BILLING_REFUND,
    label: 'Chi phí & Hoàn tiền',
    subCategories: [
      { id: 'BILLING_UNAUTHORIZED_SURCHARGE', label: 'Thu thêm phụ phí bất hợp lý ngoài hợp đồng', defaultPriority: 'URGENT' },
      { id: 'BILLING_LATE_OR_WRONG_REFUND', label: 'Chậm trễ hoàn tiền hủy tour theo chính sách', defaultPriority: 'URGENT' },
      { id: 'BILLING_TICKET_PRICE_DISCREPANCY', label: 'Chênh lệch / gian lận giá vé tham quan', defaultPriority: 'HIGH' },
    ],
  },
  {
    id: COMPLAINT_TICKET_CATEGORY.SAFETY_URGENT,
    label: 'An toàn & Sự cố khẩn cấp',
    subCategories: [
      { id: 'SAFETY_INJURY_NO_SUPPORT', label: 'Sự cố tai nạn nhưng không được hỗ trợ y tế kịp thời', defaultPriority: 'URGENT' },
      { id: 'SAFETY_LOST_PROPERTY_NEGLIGENCE', label: 'Thất lạc hành lý / tài sản do sơ suất của đơn vị tổ chức', defaultPriority: 'URGENT' },
    ],
  },
  {
    id: COMPLAINT_TICKET_CATEGORY.OTHER,
    label: 'Vấn đề khác',
    subCategories: [
      { id: 'OTHER_SERVICE_ISSUE', label: 'Phản ánh khác về chất lượng tour', defaultPriority: 'NORMAL' },
    ],
  },
];
